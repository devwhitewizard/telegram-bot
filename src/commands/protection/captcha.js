const settingsRepository = require("../../database/repositories/settingsRepository");
const { getCommandArgs } = require("../../utils/extractUser");

module.exports = {
    name: "captcha",
    description: "Configure new-member CAPTCHA verification (on|off|timeout <sec>|action <kick|mute>)",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const group = ctx.state.group;
        const settings = ctx.state.groupSettings;
        const sub = (args[0] || "").toLowerCase();

        if (sub === "on") {
            await settingsRepository.updateGroupSettings(group.id, { captchaEnabled: true });
            await ctx.reply("✅ CAPTCHA verification enabled for new members.");
            return;
        }
        if (sub === "off") {
            await settingsRepository.updateGroupSettings(group.id, { captchaEnabled: false });
            await ctx.reply("❌ CAPTCHA verification disabled.");
            return;
        }
        if (sub === "timeout") {
            const sec = Number.parseInt(args[1], 10);
            if (!Number.isInteger(sec) || sec < 30 || sec > 600) {
                await ctx.reply("Usage: /captcha timeout <seconds> (30–600)");
                return;
            }
            await settingsRepository.updateGroupSettings(group.id, {
                captchaTimeoutSeconds: sec,
            });
            await ctx.reply(`✅ CAPTCHA timeout set to ${sec} seconds.`);
            return;
        }
        if (sub === "action") {
            const action = (args[1] || "").toUpperCase();
            if (!["KICK", "MUTE"].includes(action)) {
                await ctx.reply("Invalid action. Choose: kick or mute.");
                return;
            }
            await settingsRepository.updateGroupSettings(group.id, { captchaAction: action });
            await ctx.reply(`✅ Unverified CAPTCHA action set to ${action}.`);
            return;
        }

        await ctx.reply(
            `CAPTCHA is currently ${settings.captchaEnabled ? "ON" : "OFF"}.\n` +
                `Timeout: ${settings.captchaTimeoutSeconds}s | Action on expiry: ${settings.captchaAction}\n\n` +
                `Usage:\n/captcha on | off\n/captcha timeout <seconds>\n/captcha action <kick|mute>`
        );
    },
};

