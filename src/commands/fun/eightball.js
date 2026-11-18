const { eightBall } = require("../../data/entertainmentData");
const { getCommandArgs } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "8ball",
    description: "Ask the Magic 8-Ball a yes/no question",
    execute: async (ctx) => {
        const question = getCommandArgs(ctx).join(" ").trim();
        if (!question) {
            await ctx.reply("Ask a question! Example: /8ball Will it rain today?");
            return;
        }
        if (question.length > 200) {
            await ctx.reply("Please keep your question under 200 characters.");
            return;
        }

        const answer = eightBall[Math.floor(Math.random() * eightBall.length)];
        await ctx.reply(
            `🎱 <b>Q:</b> ${escapeHtml(question)}\n<b>A:</b> ${answer}`,
            { parse_mode: "HTML" }
        );
    },
};

