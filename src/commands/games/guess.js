const gameService = require("../../services/gameService");

module.exports = {
    name: "guess",
    description: "Start a number guessing game (1–100)",
    groupOnly: true,
    execute: async (ctx) => {
        const result = await gameService.startGuessSession({
            groupId: ctx.state.group.id,
            hostUserId: ctx.state.user.id,
        });

        if (result.conflict) {
            await ctx.reply("A text game is already active in this group! Finish it first.");
            return;
        }

        await ctx.reply(
            `🔢 <b>Number Guessing!</b> (+15 pts)\nI'm thinking of a number between <b>1</b> and <b>${result.maxNumber}</b>.\n<i>Send numbers in chat to guess!</i>`,
            { parse_mode: "HTML" }
        );
    },
};

