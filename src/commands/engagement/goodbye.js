const settingsRepository = require("../../database/repositories/settingsRepository");
const { DEFAULT_GOODBYE_TEMPLATE } = require("../../services/engagementService");
const { getCommandArgs } = require("../../utils/extractUser");

module.exports = {
    name: "goodbye",
    description: "Configure group goodbye messages (on|off|set <text>|delete <sec>)",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const group = ctx.state.group;
        const settings = ctx.state.groupSettings;
        const sub = (args[0] || "").toLowerCase();

        if (sub === "on") {
            await settingsRepository.updateGroupSettings(group.id, { goodbyeEnabled: true });
            await ctx.reply("✅ Goodbye messages enabled.");
            return;
        }
        if (sub === "off") {
            await settingsRepository.updateGroupSettings(group.id, { goodbyeEnabled: false });
            await ctx.reply("❌ Goodbye messages disabled.");
            return;
        }
        if (sub === "set") {
            const text = args.slice(1).join(" ").trim();
            if (!text) {
                await ctx.reply("Usage: /goodbye set <message>\nVariables: {user}, {username}, {id}, {group}");
                return;
            }
            await settingsRepository.updateGroupSettings(group.id, { goodbyeMessage: text });
            await ctx.reply("✅ Custom goodbye message saved.");
            return;
        }
        if (sub === "delete") {
            const sec = Number.parseInt(args[1], 10);
            if (!Number.isInteger(sec) || sec < 0 || sec > 3600) {
                await ctx.reply("Usage: /goodbye delete <seconds> (0 to disable, max 3600)");
                return;
            }
            await settingsRepository.updateGroupSettings(group.id, {
                goodbyeDeleteAfterSeconds: sec,
            });
            await ctx.reply(
                sec === 0
                    ? "✅ Goodbye auto-delete disabled."
                    : `✅ Goodbye messages will auto-delete after ${sec}s.`
            );
            return;
        }

        await ctx.reply(
            `Goodbye is ${settings.goodbyeEnabled ? "ON" : "OFF"} (auto-delete: ${
                settings.goodbyeDeleteAfterSeconds
            }s).\n\nCurrent template:\n${settings.goodbyeMessage || DEFAULT_GOODBYE_TEMPLATE}`
        );
    },
};

