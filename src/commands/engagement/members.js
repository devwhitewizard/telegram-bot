const activityService = require("../../services/activityService");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "members",
    description: "Show group member count and tracked member summary",
    groupOnly: true,
    execute: async (ctx) => {
        let count = "?";
        try {
            count = await ctx.telegram.getChatMembersCount(ctx.chat.id);
        } catch {
            count = "?";
        }

        const stats = await activityService.getGroupStats(ctx.state.group.id);
        await ctx.reply(
            `👥 <b>${escapeHtml(ctx.chat.title || "Group")}</b>\n` +
                `• Total Members: <b>${count}</b>\n` +
                `• Tracked Active Members: <b>${stats.trackedMembers}</b>\n\n` +
                `Use /topmembers to view the most active members.`,
            { parse_mode: "HTML" }
        );
    },
};

