const quizCommand = require("./quiz");
const { Markup } = require("telegraf");
const gameService = require("../../services/gameService");
const { getCommandArgs } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "trivia",
    description: "Start a trivia question [easy|medium|hard]",
    groupOnly: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const difficulty = ["easy", "medium", "hard"].includes((args[0] || "").toLowerCase())
            ? args[0].toLowerCase()
            : null;

        const result = await gameService.startQuizSession({
            groupId: ctx.state.group.id,
            hostUserId: ctx.state.user.id,
            gameType: "TRIVIA",
            difficulty,
        });

        if (result.conflict) {
            await ctx.reply("A quiz/trivia game is already active in this group!");
            return;
        }

        const buttons = result.question.options.map((opt, idx) => [
            Markup.button.callback(opt, `quiz:${result.session.id}:${idx}`),
        ]);

        await ctx.reply(
            `🎯 <b>TRIVIA</b> (${result.question.difficulty.toUpperCase()} • +${result.points} pts)\n\n` +
                `${escapeHtml(result.question.question)}`,
            {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard(buttons),
            }
        );
    },
};

