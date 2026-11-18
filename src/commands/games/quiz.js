const { Markup } = require("telegraf");
const gameService = require("../../services/gameService");
const { getCommandArgs } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

async function launchQuizCommand(ctx, gameType = "QUIZ") {
    const args = getCommandArgs(ctx);
    const difficulty = ["easy", "medium", "hard"].includes((args[0] || "").toLowerCase())
        ? args[0].toLowerCase()
        : null;

    const result = await gameService.startQuizSession({
        groupId: ctx.state.group.id,
        hostUserId: ctx.state.user.id,
        gameType,
        difficulty,
    });

    if (result.conflict) {
        await ctx.reply("A quiz/trivia game is already active in this group! Answer it first.");
        return;
    }

    const buttons = result.question.options.map((opt, idx) => [
        Markup.button.callback(opt, `quiz:${result.session.id}:${idx}`),
    ]);

    await ctx.reply(
        `🧠 <b>${gameType}</b> (${result.question.difficulty.toUpperCase()} • +${result.points} pts)\n\n` +
            `${escapeHtml(result.question.question)}`,
        {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard(buttons),
        }
    );
}

module.exports = {
    name: "quiz",
    description: "Start a multiple-choice quiz game [easy|medium|hard]",
    groupOnly: true,
    execute: async (ctx) => launchQuizCommand(ctx, "QUIZ"),
};

