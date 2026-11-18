const githubService = require("../../services/githubService");
const { getCommandArgs } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "github",
    description: "Look up a GitHub user or repository (/github <user | owner/repo>)",
    cooldown: 5,
    execute: async (ctx) => {
        const target = getCommandArgs(ctx)[0];
        if (!target) {
            await ctx.reply("Usage: /github <username> or /github <owner/repo>");
            return;
        }

        try {
            const res = await githubService.lookupGithub(target);
            if (!res.found) {
                await ctx.reply(`GitHub ${res.kind} "${escapeHtml(res.query)}" was not found.`, {
                    parse_mode: "HTML",
                });
                return;
            }

            if (res.kind === "repo") {
                await ctx.reply(
                    `📦 <b>${escapeHtml(res.fullName)}</b>\n` +
                        `${escapeHtml(res.description)}\n\n` +
                        `• ⭐ Stars: <b>${res.stars}</b> | 🍴 Forks: <b>${res.forks}</b>\n` +
                        `• Language: <b>${escapeHtml(res.language)}</b>\n` +
                        `• URL: ${escapeHtml(res.url)}`,
                    { parse_mode: "HTML", disable_web_page_preview: true }
                );
                return;
            }

            await ctx.reply(
                `🐙 <b>${escapeHtml(res.name)}</b> (@${escapeHtml(res.login)})\n` +
                    `${escapeHtml(res.bio)}\n\n` +
                    `• Public Repos: <b>${res.publicRepos}</b> | Followers: <b>${res.followers}</b>\n` +
                    `• URL: ${escapeHtml(res.url)}`,
                { parse_mode: "HTML", disable_web_page_preview: true }
            );
        } catch (err) {
            await ctx.reply(err.message || "Could not query GitHub right now.");
        }
    },
};

