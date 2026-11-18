const settingsRepository = require("../../database/repositories/settingsRepository");
const { getCommandArgs } = require("../../utils/extractUser");

module.exports = {
    name: "setrules",
    description: "Set custom group rules (Admin only)",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const text = getCommandArgs(ctx).join(" ").trim();
        if (!text) {
            await ctx.reply("Usage: /setrules <rules text>");
            return;
        }
        if (text.length > 2000) {
            await ctx.reply("Rules text must be 2000 characters or fewer.");
            return;
        }

        await settingsRepository.updateGroupSettings(ctx.state.group.id, { rules: text });
        await ctx.reply("✅ Group rules updated.");
    },
};

