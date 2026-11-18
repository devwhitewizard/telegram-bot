const { Markup } = require("telegraf");
const scoreService = require("../../services/scoreService");
const { getCommandArgs } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "leaderboard",
    description: "Show the group game leaderboard [all|daily|weekly]",
    groupOnly: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const period = ["all", "daily", "weekly"].includes((args[0] || "").toLowerCase())
            ? args[0].toLowerCase()
            : "all";

        const { rows } = await scoreService.getLeaderboard(ctx.state.group.id, {
            period,
            page: 1,
            pageSize: 10,
        });

        const filterRow = [
            Markup.button.callback("All-Time", "lb:all:1"),
            Markup.button.callback("Daily", "lb:daily:1"),
            Markup.button.callback("Weekly", "lb:weekly:1"),
        ];

        if (rows.length === 0) {
            await ctx.reply(`🏆 No scores recorded yet for <b>${period}</b>.`, {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard([filterRow]),
            });
            return;
        }

        const lines = rows.map((row, idx) => {
            const name = escapeHtml(row.user?.firstName || "Player");
            return `${idx + 1}. <b>${name}</b> — ${row.score} pts`;
        });

        await ctx.reply(
            `🏆 <b>Leaderboard (${period.toUpperCase()})</b>\n\n${lines.join("\n")}`,
            {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard([filterRow]),
            }
        );
    },
};

