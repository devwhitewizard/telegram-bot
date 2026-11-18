const gameService = require("../../services/gameService");

module.exports = {
    name: "wordchain",
    description: "Start a Word Chain game (next word starts with previous last letter)",
    groupOnly: true,
    execute: async (ctx) => {
        const result = await gameService.startWordChainSession({
            groupId: ctx.state.group.id,
            hostUserId: ctx.state.user.id,
        });

        if (result.conflict) {
            await ctx.reply("A text game is already active in this group! Finish it first.");
            return;
        }

        const nextLetter = result.seedWord.slice(-1).toUpperCase();
        await ctx.reply(
            `🔤 <b>Word Chain Started!</b> (+5 pts per valid word)\n` +
                `Starting word: <b>${result.seedWord}</b>\n` +
                `Next word must start with <b>${nextLetter}</b>!`,
            { parse_mode: "HTML" }
        );
    },
};

