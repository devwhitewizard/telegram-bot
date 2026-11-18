const { Telegraf } = require("telegraf");
const { env } = require("./config/env");
const botConfig = require("./config/botConfig");
const { createChildLogger } = require("./utils/logger");
const errorMiddleware = require("./middlewares/errorMiddleware");
const userRegistrationMiddleware = require("./middlewares/userRegistrationMiddleware");
const groupRegistrationMiddleware = require("./middlewares/groupRegistrationMiddleware");
const activityMiddleware = require("./middlewares/activityMiddleware");
const captchaMiddleware = require("./middlewares/captchaMiddleware");
const { moderationMiddleware } = require("./middlewares/moderationMiddleware");
const antiFloodMiddleware = require("./middlewares/antiFloodMiddleware");
const antiSpamMiddleware = require("./middlewares/antiSpamMiddleware");
const antiLinkMiddleware = require("./middlewares/antiLinkMiddleware");
const { badWordMiddleware } = require("./middlewares/badWordMiddleware");
const { registerCaptchaHandlers } = require("./handlers/moderationHandler");
const { registerMemberHandlers } = require("./handlers/memberHandler");
const { registerGameHandlers } = require("./handlers/gameHandler");
const { registerSettingsHandlers } = require("./handlers/settingsHandler");
const { registerCommands } = require("./commands");

const botLogger = createChildLogger("bot");

/**
 * Create and configure the Telegraf bot instance.
 * Registers global middlewares in strict order, protection filters,
 * member/game handlers, and all discovered commands.
 */
function createBot(token = env.botToken, options = {}) {
    const bot = new Telegraf(token, {
        handlerTimeout: botConfig.telegraf.handlerTimeout,
        ...options,
    });

    bot.catch(async (err, ctx) => {
        botLogger.error(
            {
                err,
                updateType: ctx?.updateType,
                chatId: ctx?.chat?.id,
                userId: ctx?.from?.id,
            },
            "Unhandled error while processing Telegram update"
        );

        try {
            if (ctx?.chat?.id) {
                await ctx.reply("An unexpected error occurred. Please try again later.");
            }
        } catch (replyErr) {
            botLogger.warn({ err: replyErr }, "Failed to send fallback error reply");
        }
    });

    // 1. Global error boundary, registration & batched activity tracking
    bot.use(errorMiddleware);
    bot.use(userRegistrationMiddleware);
    bot.use(groupRegistrationMiddleware);
    bot.use(activityMiddleware);

    // 2. Group protection pipeline
    bot.use(captchaMiddleware);
    bot.use(moderationMiddleware);
    bot.use(antiFloodMiddleware);
    bot.use(antiSpamMiddleware);
    bot.use(antiLinkMiddleware);
    bot.use(badWordMiddleware);

    // 3. Member join/leave, CAPTCHA & settings callback handlers
    registerMemberHandlers(bot);
    registerCaptchaHandlers(bot);
    registerSettingsHandlers(bot);

    // 4. Discover and register all commands + per-command middlewares
    const { menuCommands } = registerCommands(bot);
    bot.menuCommands = menuCommands;

    // 5. Game callbacks & text-answer listener (registered after commands)
    registerGameHandlers(bot);

    return bot;
}

module.exports = {
    createBot,
};
