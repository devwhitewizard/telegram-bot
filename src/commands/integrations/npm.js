const npmService = require("../../services/npmService");
const { getCommandArgs } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "npm",
    description: "Look up an NPM package (/npm <package>)",
    cooldown: 5,
    execute: async (ctx) => {
        const pkgName = getCommandArgs(ctx)[0];
        if (!pkgName) {
            await ctx.reply("Usage: /npm <package-name>");
            return;
        }

        try {
            const res = await npmService.lookupNpmPackage(pkgName);
            if (!res.found) {
                await ctx.reply(`NPM package "${escapeHtml(res.name)}" was not found.`, {
                    parse_mode: "HTML",
                });
                return;
            }

            const lines = [
                `📦 <b>${escapeHtml(res.name)}</b> (v${escapeHtml(res.version)})`,
                escapeHtml(res.description),
                "",
            ];
            if (res.author) lines.push(`• Author: <b>${escapeHtml(res.author)}</b>`);
            if (res.weeklyDownloads !== null) {
                lines.push(`• Weekly Downloads: <b>${res.weeklyDownloads.toLocaleString()}</b>`);
            }
            lines.push(`• URL: ${escapeHtml(res.url)}`);

            await ctx.reply(lines.join("\n"), {
                parse_mode: "HTML",
                disable_web_page_preview: true,
            });
        } catch (err) {
            await ctx.reply(err.message || "Could not query NPM right now.");
        }
    },
};
