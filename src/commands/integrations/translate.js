const translationService = require("../../services/translationService");
const { getCommandArgs } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "translate",
    description: "Translate text (/translate <lang> <text> or /translate <src>:<dst> <text>)",
    cooldown: 10,
    singleFlight: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const langSpec = args[0];
        const replyText = ctx.message?.reply_to_message?.text || "";
        const text = args.slice(1).join(" ").trim() || replyText.trim();

        if (!langSpec || !text) {
            await ctx.reply(
                "Usage: /translate <targetLang> <text>\n" +
                    "Or: /translate <source>:<target> <text>\n" +
                    "Example: /translate es Hello world"
            );
            return;
        }

        let sourceLang = "auto";
        let targetLang = langSpec;
        if (langSpec.includes(":")) {
            const [src, dst] = langSpec.split(":");
            sourceLang = src || "auto";
            targetLang = dst || "";
        }

        try {
            const res = await translationService.translateText({
                text,
                sourceLang,
                targetLang,
            });

            await ctx.reply(
                `🌐 <b>Translation (${escapeHtml(res.sourceLang)} → ${escapeHtml(
                    res.targetLang
                )})</b>\n\n${escapeHtml(res.translatedText)}`,
                { parse_mode: "HTML" }
            );
        } catch (err) {
            await ctx.reply(err.message || "Translation service is currently unavailable.");
        }
    },
};
