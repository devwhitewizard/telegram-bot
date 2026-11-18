const scoreService = require("../../services/scoreService");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "myscore",
    description: "View your game score, wins, losses, and streak in this group",
    groupOnly: true,
    execute: async (ctx) => {
        const stats = await scoreService.getMyStats(ctx.state.group.id, ctx.state.user.id);
        const name = escapeHtml(ctx.from.first_name || "Player");

        await ctx.reply(
            `🏅 <b>${name}'s Game Stats</b>\n\n` +
                `• Total Score: <b>${stats?.score || 0}</b>\n` +
                `• Wins: <b>${stats?.wins || 0}</b>\n` +
                `• Losses: <b>${stats?.losses || 0}</b>\n` +
                `• Current Streak: <b>${stats?.streak || 0}</b> (Best: ${stats?.bestStreak || 0})`,
            { parse_mode: "HTML" }
        );
    },
};

