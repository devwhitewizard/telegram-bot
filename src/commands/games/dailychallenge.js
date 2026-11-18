const { Markup } = require("telegraf");
const gameService = require("../../services/gameService");
const scoreService = require("../../services/scoreService");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "dailychallenge",
    description: "Start today's bonus Daily Challenge (+25 pts)",
    groupOnly: true,
    execute: async (ctx) => {
        if (await scoreService.hasCompletedDailyToday(ctx.state.group.id, ctx.state.user.id)) {
            await ctx.reply("You have already completed today's Daily Challenge! Come back tomorrow.");
            return;
        }

        const result = await gameService.startQuizSession({
            groupId: ctx.state.group.id,
            hostUserId: ctx.state.user.id,
            gameType: "DAILY",
            expiresInSeconds: 90,
        });

        if (result.conflict) {
            await ctx.reply("A quiz/daily challenge is already active in this group!");
            return;
        }

        const buttons = result.question.options.map((opt, idx) => [
            Markup.button.callback(opt, `quiz:${result.session.id}:${idx}`),
        ]);

        await ctx.reply(
            `🌟 <b>Daily Challenge</b> (+${result.points} pts)\n\n${escapeHtml(
                result.question.question
            )}`,
            {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard(buttons),
            }
        );
    },
};

