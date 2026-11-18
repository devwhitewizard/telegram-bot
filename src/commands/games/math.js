const gameService = require("../../services/gameService");
const { getCommandArgs } = require("../../utils/extractUser");

module.exports = {
    name: "math",
    description: "Start a math challenge [easy|medium|hard]",
    groupOnly: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const difficulty = (args[0] || "easy").toLowerCase();

        const result = await gameService.startMathSession({
            groupId: ctx.state.group.id,
            hostUserId: ctx.state.user.id,
            difficulty,
        });

        if (result.conflict) {
            await ctx.reply("A text game is already active in this group! Finish it first.");
            return;
        }

        await ctx.reply(
            `🧮 <b>Math Challenge</b> (${result.problem.difficulty.toUpperCase()} • +${
                result.problem.points
            } pts)\n\nWhat is <b>${result.problem.prompt}</b>?\n<i>Type the number in chat within 45s!</i>`,
            { parse_mode: "HTML" }
        );
    },
};

