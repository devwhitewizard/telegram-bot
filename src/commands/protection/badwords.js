const settingsRepository = require("../../database/repositories/settingsRepository");
const { getCommandArgs } = require("../../utils/extractUser");

module.exports = {
    name: "badwords",
    description: "Enable or disable the bad-word filter (on|off)",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const group = ctx.state.group;
        const settings = ctx.state.groupSettings;
        const sub = (args[0] || "").toLowerCase();

        if (sub === "on") {
            await settingsRepository.updateGroupSettings(group.id, {
                badWordFilterEnabled: true,
            });
            await ctx.reply("✅ Bad-word filter enabled.");
            return;
        }
        if (sub === "off") {
            await settingsRepository.updateGroupSettings(group.id, {
                badWordFilterEnabled: false,
            });
            await ctx.reply("❌ Bad-word filter disabled.");
            return;
        }

        await ctx.reply(
            `Bad-word filter is currently ${settings.badWordFilterEnabled ? "ON" : "OFF"}.\n` +
                `Usage: /badwords on | off\nManage words with /addword, /removeword, /blockedwords.`
        );
    },
};

