const settingsRepository = require("../../database/repositories/settingsRepository");
const { getCommandArgs } = require("../../utils/extractUser");

module.exports = {
    name: "antispam",
    description: "Configure anti-spam protection (on|off|threshold <count> [seconds])",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const group = ctx.state.group;
        const settings = ctx.state.groupSettings;
        const sub = (args[0] || "").toLowerCase();

        if (sub === "on") {
            await settingsRepository.updateGroupSettings(group.id, { antiSpamEnabled: true });
            await ctx.reply("✅ Anti-spam protection enabled.");
            return;
        }
        if (sub === "off") {
            await settingsRepository.updateGroupSettings(group.id, { antiSpamEnabled: false });
            await ctx.reply("❌ Anti-spam protection disabled.");
            return;
        }
        if (sub === "threshold") {
            const count = Number.parseInt(args[1], 10);
            const windowSec = args[2] ? Number.parseInt(args[2], 10) : settings.antiSpamWindowSeconds;
            if (!Number.isInteger(count) || count < 2 || !Number.isInteger(windowSec) || windowSec < 5) {
                await ctx.reply("Usage: /antispam threshold <count>=2+ [windowSeconds>=5]");
                return;
            }
            await settingsRepository.updateGroupSettings(group.id, {
                antiSpamThreshold: count,
                antiSpamWindowSeconds: windowSec,
            });
            await ctx.reply(
                `✅ Anti-spam threshold set to ${count} repeated messages within ${windowSec}s.`
            );
            return;
        }

        await ctx.reply(
            `Anti-Spam is currently ${settings.antiSpamEnabled ? "ON" : "OFF"}.\n` +
                `Threshold: ${settings.antiSpamThreshold} repeated messages in ${settings.antiSpamWindowSeconds}s.\n\n` +
                `Usage:\n/antispam on\n/antispam off\n/antispam threshold <count> [seconds]`
        );
    },
};

