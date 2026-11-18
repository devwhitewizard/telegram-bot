const settingsRepository = require("../../database/repositories/settingsRepository");
const protectionService = require("../../services/protectionService");
const { getCommandArgs } = require("../../utils/extractUser");

module.exports = {
    name: "antiraid",
    description: "Configure anti-raid protection and recover from raid mode",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const group = ctx.state.group;
        const settings = ctx.state.groupSettings;
        const sub = (args[0] || "").toLowerCase();

        if (sub === "on") {
            await settingsRepository.updateGroupSettings(group.id, { antiRaidEnabled: true });
            await ctx.reply("✅ Anti-raid protection enabled.");
            return;
        }
        if (sub === "off") {
            await settingsRepository.updateGroupSettings(group.id, {
                antiRaidEnabled: false,
                raidModeActive: false,
            });
            await ctx.reply("❌ Anti-raid protection disabled.");
            return;
        }
        if (sub === "recover" || sub === "reset") {
            await protectionService.setRaidMode(group.id, false);
            await ctx.reply("✅ Raid mode deactivated. Normal member joins resumed.");
            return;
        }
        if (sub === "threshold") {
            const joins = Number.parseInt(args[1], 10);
            const windowSec = args[2] ? Number.parseInt(args[2], 10) : settings.raidWindowSeconds;
            if (!Number.isInteger(joins) || joins < 3 || !Number.isInteger(windowSec) || windowSec < 5) {
                await ctx.reply("Usage: /antiraid threshold <joins>=3+ [windowSeconds>=5]");
                return;
            }
            await settingsRepository.updateGroupSettings(group.id, {
                raidJoinThreshold: joins,
                raidWindowSeconds: windowSec,
            });
            await ctx.reply(
                `✅ Anti-raid threshold set to ${joins} joins in ${windowSec}s.`
            );
            return;
        }

        await ctx.reply(
            `Anti-Raid is currently ${settings.antiRaidEnabled ? "ON" : "OFF"} (Raid Mode: ${
                settings.raidModeActive ? "ACTIVE" : "Inactive"
            }).\n` +
                `Threshold: ${settings.raidJoinThreshold} joins / ${settings.raidWindowSeconds}s\n\n` +
                `Usage:\n/antiraid on | off\n/antiraid recover\n/antiraid threshold <joins> [seconds]`
        );
    },
};

