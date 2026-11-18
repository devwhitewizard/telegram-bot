const urlService = require("../../services/urlService");
const { getCommandArgs } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "shorten",
    description: "Shorten a public HTTP/HTTPS URL (/shorten <url>)",
    cooldown: 10,
    singleFlight: true,
    execute: async (ctx) => {
        const rawUrl = getCommandArgs(ctx)[0];
        if (!rawUrl) {
            await ctx.reply("Usage: /shorten <https://example.com/long/path>");
            return;
        }

        try {
            const res = await urlService.shortenUrl(rawUrl);
            await ctx.reply(`🔗 Shortened URL: ${escapeHtml(res.shortUrl)}`, {
                parse_mode: "HTML",
                disable_web_page_preview: true,
            });
        } catch (err) {
            await ctx.reply(err.message || "Could not shorten URL right now.");
        }
    },
};
