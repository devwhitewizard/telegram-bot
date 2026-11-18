const gameService = require("../../services/gameService");
const { buildTicTacToeKeyboard } = require("../../handlers/gameHandler");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "tictactoe",
    description: "Start a 2-player Tic-Tac-Toe game",
    groupOnly: true,
    execute: async (ctx) => {
        const result = await gameService.startTicTacToe({
            groupId: ctx.state.group.id,
            hostUserId: ctx.state.user.id,
            hostTgId: ctx.from.id,
            hostName: ctx.from.first_name || "Player X",
        });

        if (result.conflict) {
            await ctx.reply("A Tic-Tac-Toe game is already active in this group!");
            return;
        }

        const xName = escapeHtml(ctx.from.first_name || "Player X");
        await ctx.reply(
            `🎮 <b>Tic-Tac-Toe</b>\n❌ ${xName} vs ⭕ Waiting for opponent...\n\nTurn: <b>X</b> (${xName})`,
            {
                parse_mode: "HTML",
                ...buildTicTacToeKeyboard(result.session.id, result.state.board),
            }
        );
    },
};

