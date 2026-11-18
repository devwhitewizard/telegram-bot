const aiService = require("../../services/aiService");
const { getCommandArgs } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "ai",
    description: "Ask the AI assistant a question (/ai <prompt>)",
    cooldown: 15,
    singleFlight: true,
    execute: async (ctx) => {
        const prompt = getCommandArgs(ctx).join(" ").trim();
        if (!prompt) {
            await ctx.reply("Usage: /ai <your prompt>");
            return;
        }

        try {
            const result = await aiService.askAi(prompt);
            if (!result.configured) {
                await ctx.reply(result.error);
                return;
            }

            await ctx.reply(
                `🤖 <b>AI (${escapeHtml(result.model)})</b>\n\n${escapeHtml(result.text)}`,
                { parse_mode: "HTML" }
            );
        } catch (err) {
            await ctx.reply(err.message || "AI service is currently unavailable.");
        }
    },
};

