const newsService = require("../../services/newsService");
const { getCommandArgs } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "news",
    description: "Search recent news articles (/news <topic>)",
    cooldown: 15,
    singleFlight: true,
    execute: async (ctx) => {
        const query = getCommandArgs(ctx).join(" ").trim();
        if (!query) {
            await ctx.reply("Usage: /news <search topic>");
            return;
        }

        try {
            const res = await newsService.searchNews(query);
            if (!res.configured) {
                await ctx.reply(res.error);
                return;
            }

            if (res.articles.length === 0) {
                await ctx.reply(`No recent articles found for "${escapeHtml(res.query)}".`, {
                    parse_mode: "HTML",
                });
                return;
            }

            const formatted = res.articles.map((a, idx) => {
                const desc = a.description ? `\n${escapeHtml(a.description.slice(0, 140))}` : "";
                return `${idx + 1}. <b>${escapeHtml(a.title)}</b> (${escapeHtml(a.source)})${desc}\n${escapeHtml(a.url)}`;
            });

            await ctx.reply(
                `📰 <b>News for "${escapeHtml(res.query)}"</b>\n\n${formatted.join("\n\n")}`,
                { parse_mode: "HTML", disable_web_page_preview: true }
            );
        } catch (err) {
            await ctx.reply(err.message || "Could not fetch news right now.");
        }
    },
};

