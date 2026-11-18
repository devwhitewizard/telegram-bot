const fs = require("fs");
const path = require("path");
const botConfig = require("../config/botConfig");
const groupMiddleware = require("../middlewares/groupMiddleware");
const privateChatMiddleware = require("../middlewares/privateChatMiddleware");
const adminMiddleware = require("../middlewares/adminMiddleware");
const { createCooldownMiddleware } = require("../middlewares/cooldownMiddleware");
const settingsService = require("../services/settingsService");
const metricsService = require("../services/metricsService");
const { createChildLogger } = require("../utils/logger");

const cmdLogger = createChildLogger("commandRegistry");

/**
 * Recursively collect all .js file paths under a directory, excluding index.js.
 * @param {string} dir
 * @returns {string[]}
 */
function collectCommandFiles(dir) {
    if (!fs.existsSync(dir)) {
        return [];
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectCommandFiles(fullPath));
        } else if (
            entry.isFile() &&
            entry.name.endsWith(".js") &&
            path.resolve(fullPath) !== path.resolve(__filename)
        ) {
            files.push(fullPath);
        }
    }

    return files.sort();
}

/**
 * Validate a loaded command module structure.
 * @param {unknown} mod
 * @param {string} filePath
 */
function validateCommandModule(mod, filePath) {
    if (!mod || typeof mod !== "object") {
        throw new Error(`Command file ${filePath} must export an object`);
    }
    if (!mod.name || typeof mod.name !== "string") {
        throw new Error(`Command file ${filePath} is missing a valid string "name"`);
    }
    if (!mod.description || typeof mod.description !== "string") {
        throw new Error(`Command file ${filePath} is missing a valid string "description"`);
    }
    if (typeof mod.execute !== "function") {
        throw new Error(`Command file ${filePath} is missing an "execute" function`);
    }
    if (mod.groupOnly && mod.privateOnly) {
        throw new Error(`Command "${mod.name}" cannot be both groupOnly and privateOnly`);
    }
}

/**
 * Discover and load all command modules from a directory tree.
 * @param {string} [commandsDir=__dirname]
 * @returns {Map<string, object>}
 */
function loadCommands(commandsDir = __dirname) {
    const files = collectCommandFiles(commandsDir);
    const commands = new Map();

    for (const filePath of files) {
        const mod = require(filePath);
        validateCommandModule(mod, filePath);

        const normalizedName = mod.name.trim().toLowerCase().replace(/^\//, "");
        if (commands.has(normalizedName)) {
            throw new Error(`Duplicate command name detected: "${normalizedName}"`);
        }

        const category = path.basename(path.dirname(filePath)).toLowerCase();

        commands.set(normalizedName, {
            ...mod,
            name: normalizedName,
            category: mod.category || category,
            filePath,
        });
    }

    return commands;
}

function createCommandAccessMiddleware(cmd) {
    return async function commandAccessMiddleware(ctx, next) {
        const settings = ctx.state?.groupSettings;
        if (!settings) {
            return next();
        }

        if (cmd.category === "games" && settings.gamesEnabled === false) {
            await ctx.reply("Games are currently disabled in this group.");
            return;
        }

        if (cmd.category === "fun" && settings.funEnabled === false) {
            await ctx.reply("Entertainment commands are currently disabled in this group.");
            return;
        }

        const override = settingsService.getCommandPermission(settings, cmd.name);
        if (override === "disabled") {
            await ctx.reply(`The /${cmd.name} command is disabled in this group.`);
            return;
        }

        if (override === "admin" && !cmd.adminOnly) {
            return adminMiddleware(ctx, next);
        }

        return next();
    };
}

/**
 * Build the per-command middleware pipeline from command metadata.
 * @param {object} cmd
 * @returns {Array<(ctx: import("telegraf").Context, next: () => Promise<void>) => Promise<void>>}
 */
function buildCommandMiddlewares(cmd) {
    const middlewares = [createCommandAccessMiddleware(cmd)];

    if (cmd.groupOnly) {
        middlewares.push(groupMiddleware);
    } else if (cmd.privateOnly) {
        middlewares.push(privateChatMiddleware);
    }

    if (cmd.adminOnly) {
        middlewares.push(adminMiddleware);
    }

    const cooldownSeconds =
        cmd.cooldown !== undefined
            ? cmd.cooldown
            : botConfig.defaults.commandCooldownSeconds;

    if (cooldownSeconds > 0 || cmd.singleFlight) {
        middlewares.push(
            createCooldownMiddleware(cooldownSeconds, {
                singleFlight: Boolean(cmd.singleFlight),
            })
        );
    }

    return middlewares;
}

/**
 * Wrap command execution to track usage counts, execution duration, and failures.
 */
function wrapCommandWithTracking(cmd) {
    return async function trackedCommandExecute(ctx) {
        const start = Date.now();
        metricsService.recordCommandUsage(cmd.name);
        try {
            const result = await cmd.execute(ctx);
            cmdLogger.info(
                {
                    event: "command_executed",
                    command: cmd.name,
                    category: cmd.category,
                    chatId: ctx.chat?.id,
                    chatType: ctx.chat?.type,
                    userId: ctx.from?.id,
                    durationMs: Date.now() - start,
                },
                "Command executed"
            );
            return result;
        } catch (err) {
            cmdLogger.error(
                {
                    err,
                    event: "command_failed",
                    command: cmd.name,
                    chatId: ctx.chat?.id,
                    userId: ctx.from?.id,
                    durationMs: Date.now() - start,
                },
                "Command execution failed"
            );
            throw err;
        }
    };
}

/**
 * Register all discovered commands on a Telegraf bot instance.
 *
 * @param {import("telegraf").Telegraf} bot
 * @param {string} [commandsDir=__dirname]
 * @returns {{ commands: Map<string, object>, menuCommands: Array<{ command: string, description: string }> }}
 */
function registerCommands(bot, commandsDir = __dirname) {
    const commands = loadCommands(commandsDir);
    bot.context.commands = commands;

    const menuCommands = [];

    for (const cmd of commands.values()) {
        const middlewares = buildCommandMiddlewares(cmd);
        const trackedExecute = wrapCommandWithTracking(cmd);
        const triggers = [cmd.name, ...(Array.isArray(cmd.aliases) ? cmd.aliases : [])];

        for (const trigger of triggers) {
            const cleanTrigger = trigger.trim().toLowerCase().replace(/^\//, "");
            if (cleanTrigger === "start") {
                bot.start(...middlewares, trackedExecute);
            } else if (cleanTrigger === "help") {
                bot.help(...middlewares, trackedExecute);
            } else {
                bot.command(cleanTrigger, ...middlewares, trackedExecute);
            }
        }

        if (!cmd.hidden) {
            menuCommands.push({
                command: cmd.name,
                description: cmd.description.slice(0, 256),
            });
        }

        cmdLogger.debug(
            {
                command: cmd.name,
                groupOnly: Boolean(cmd.groupOnly),
                privateOnly: Boolean(cmd.privateOnly),
                adminOnly: Boolean(cmd.adminOnly),
            },
            "Registered command"
        );
    }

    cmdLogger.info({ count: commands.size }, "All commands registered");

    return {
        commands,
        menuCommands,
    };
}

module.exports = {
    collectCommandFiles,
    validateCommandModule,
    loadCommands,
    buildCommandMiddlewares,
    registerCommands,
};

