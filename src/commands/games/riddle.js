const gameService = require("../../services/gameService");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "riddle",
    description: "Start a riddle challenge (reply in chat to answer)",
    groupOnly: true,
    execute: async (ctx) => {
        const result = await gameService.startRiddleSession({
            groupId: ctx.state.group.id,
            hostUserId: ctx.state.user.id,
        });

        if (result.conflict) {
            await ctx.reply("A text game is already active in this group! Solve or finish it first.");
            return;
        }

        await ctx.reply(
            `🧩 <b>Riddle Time!</b> (+15 pts)\n\n${escapeHtml(
                result.riddle.question
            )}\n\n<i>Type your answer in the chat within 90s!</i>`,
            { parse_mode: "HTML" }
        );
    },
};

