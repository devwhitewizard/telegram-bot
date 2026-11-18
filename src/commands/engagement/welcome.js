const settingsRepository = require("../../database/repositories/settingsRepository");
const { DEFAULT_WELCOME_TEMPLATE } = require("../../services/engagementService");
const { getCommandArgs } = require("../../utils/extractUser");

module.exports = {
    name: "welcome",
    description: "Configure group welcome messages (on|off|set <text>|image <url|off>|delete <sec>)",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const group = ctx.state.group;
        const settings = ctx.state.groupSettings;
        const sub = (args[0] || "").toLowerCase();

        if (sub === "on") {
            await settingsRepository.updateGroupSettings(group.id, { welcomeEnabled: true });
            await ctx.reply("✅ Welcome messages enabled.");
            return;
        }
        if (sub === "off") {
            await settingsRepository.updateGroupSettings(group.id, { welcomeEnabled: false });
            await ctx.reply("❌ Welcome messages disabled.");
            return;
        }
        if (sub === "set") {
            const text = args.slice(1).join(" ").trim();
            if (!text) {
                await ctx.reply(
                    "Usage: /welcome set <message>\nVariables: {user}, {username}, {id}, {group}, {count}"
                );
                return;
            }
            await settingsRepository.updateGroupSettings(group.id, { welcomeMessage: text });
            await ctx.reply("✅ Custom welcome message saved.");
            return;
        }
        if (sub === "image") {
            const url = (args[1] || "").trim();
            if (!url) {
                await ctx.reply("Usage: /welcome image <https_url | off>");
                return;
            }
            const nextVal = url.toLowerCase() === "off" ? null : url;
            await settingsRepository.updateGroupSettings(group.id, { welcomeImageUrl: nextVal });
            await ctx.reply(nextVal ? "✅ Welcome image updated." : "❌ Welcome image removed.");
            return;
        }
        if (sub === "delete") {
            const sec = Number.parseInt(args[1], 10);
            if (!Number.isInteger(sec) || sec < 0 || sec > 3600) {
                await ctx.reply("Usage: /welcome delete <seconds> (0 to disable, max 3600)");
                return;
            }
            await settingsRepository.updateGroupSettings(group.id, {
                welcomeDeleteAfterSeconds: sec,
            });
            await ctx.reply(
                sec === 0
                    ? "✅ Welcome auto-delete disabled."
                    : `✅ Welcome messages will auto-delete after ${sec}s.`
            );
            return;
        }

        await ctx.reply(
            `Welcome is ${settings.welcomeEnabled ? "ON" : "OFF"} (auto-delete: ${
                settings.welcomeDeleteAfterSeconds
            }s).\n\nCurrent template:\n${settings.welcomeMessage || DEFAULT_WELCOME_TEMPLATE}`
        );
    },
};

