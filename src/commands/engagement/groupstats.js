const activityService = require("../../services/activityService");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "groupstats",
    description: "Show group message and member activity statistics",
    groupOnly: true,
    execute: async (ctx) => {
        const stats = await activityService.getGroupStats(ctx.state.group.id);
        let telegramCount = "?";
        try {
            telegramCount = await ctx.telegram.getChatMembersCount(ctx.chat.id);
        } catch {
            telegramCount = "?";
        }

        await ctx.reply(
            `📈 <b>${escapeHtml(ctx.chat.title || "Group")} Statistics</b>\n\n` +
                `• Total Telegram Members: <b>${telegramCount}</b>\n` +
                `• Tracked Active Members: <b>${stats.trackedMembers}</b>\n` +
                `• Messages Today: <b>${stats.todayMessages}</b>\n` +
                `• All-Time Tracked Messages: <b>${stats.totalMessages}</b>`,
            { parse_mode: "HTML" }
        );
    },
};

