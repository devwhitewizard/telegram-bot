const settingsRepository = require("../../database/repositories/settingsRepository");
const { getCommandArgs } = require("../../utils/extractUser");

module.exports = {
    name: "activity",
    description: "Enable or disable group activity tracking (on|off)",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const sub = (args[0] || "").toLowerCase();
        const group = ctx.state.group;
        const settings = ctx.state.groupSettings;

        if (sub === "on") {
            await settingsRepository.updateGroupSettings(group.id, {
                activityTrackingEnabled: true,
            });
            await ctx.reply("✅ Activity tracking enabled.");
            return;
        }
        if (sub === "off") {
            await settingsRepository.updateGroupSettings(group.id, {
                activityTrackingEnabled: false,
            });
            await ctx.reply("❌ Activity tracking disabled.");
            return;
        }

        await ctx.reply(
            `Activity tracking is currently ${
                settings.activityTrackingEnabled ? "ON" : "OFF"
            }.\nUsage: /activity on | off`
        );
    },
};

