const settingsRepository = require("../../database/repositories/settingsRepository");
const { getCommandArgs } = require("../../utils/extractUser");

module.exports = {
    name: "protection",
    description: "View group protection status and configure warning policy",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const group = ctx.state.group;
        const settings = ctx.state.groupSettings;
        const sub = (args[0] || "").toLowerCase();

        if (sub === "maxwarns" && args[1]) {
            const max = Number.parseInt(args[1], 10);
            if (!Number.isInteger(max) || max < 1 || max > 20) {
                await ctx.reply("Please provide a number between 1 and 20.");
                return;
            }
            await settingsRepository.updateGroupSettings(group.id, { maxWarnings: max });
            await ctx.reply(`✅ Max warnings set to ${max}.`);
            return;
        }

        if (sub === "warnaction" && args[1]) {
            const action = args[1].toUpperCase();
            if (!["MUTE", "KICK", "BAN"].includes(action)) {
                await ctx.reply("Invalid warn action. Choose: mute, kick, or ban.");
                return;
            }
            await settingsRepository.updateGroupSettings(group.id, { warnAction: action });
            await ctx.reply(`✅ Warning threshold action set to ${action}.`);
            return;
        }

        await ctx.reply(
            `🛡️ <b>Group Protection Status</b>\n\n` +
                `• Anti-Spam: ${settings.antiSpamEnabled ? "ON" : "OFF"} (${settings.antiSpamThreshold} / ${settings.antiSpamWindowSeconds}s)\n` +
                `• Anti-Flood: ${settings.antiFloodEnabled ? "ON" : "OFF"} (${settings.antiFloodMaxMessages} / ${settings.antiFloodWindowSeconds}s → ${settings.antiFloodAction})\n` +
                `• Anti-Link: ${settings.antiLinkEnabled ? "ON" : "OFF"} (${settings.antiLinkAction})\n` +
                `• Bad-Word Filter: ${settings.badWordFilterEnabled ? "ON" : "OFF"}\n` +
                `• Anti-Raid: ${settings.antiRaidEnabled ? "ON" : "OFF"} (Raid Mode: ${settings.raidModeActive ? "ACTIVE" : "Inactive"})\n` +
                `• CAPTCHA: ${settings.captchaEnabled ? "ON" : "OFF"} (${settings.captchaTimeoutSeconds}s → ${settings.captchaAction})\n` +
                `• Warning Policy: ${settings.maxWarnings} warnings → ${settings.warnAction}\n\n` +
                `Configure via /antispam, /antiflood, /antilink, /badwords, /antiraid, /captcha, or:\n` +
                `/protection maxwarns &lt;n&gt;\n/protection warnaction &lt;mute|kick|ban&gt;`,
            { parse_mode: "HTML" }
        );
    },
};

