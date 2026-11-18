const { extractTargetUser } = require("../../utils/extractUser");
const activityRepository = require("../../database/repositories/activityRepository");
const scoreRepository = require("../../database/repositories/scoreRepository");
const userRepository = require("../../database/repositories/userRepository");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "info",
    description: "Display user and group activity/game info",
    execute: async (ctx) => {
        const { target } = await extractTargetUser(ctx);
        const subject = target || ctx.from;
        const dbUser =
            !target && ctx.state.user
                ? ctx.state.user
                : await userRepository.findUserByTelegramId(subject.id);

        const lines = [
            `ℹ️ <b>User Information</b>`,
            `• Name: <b>${escapeHtml(subject.first_name || "User")}</b>`,
            `• Telegram ID: <code>${subject.id}</code>`,
            `• Username: ${subject.username ? `@${escapeHtml(subject.username)}` : "None"}`,
        ];

        if (ctx.state.group && dbUser) {
            const [activity, stats] = await Promise.all([
                activityRepository.getUserActivity(ctx.state.group.id, dbUser.id),
                scoreRepository.getPlayerStats(ctx.state.group.id, dbUser.id),
            ]);
            lines.push(`• Group Messages: <b>${activity?.messageCount || 0}</b>`);
            lines.push(`• Game Score: <b>${stats?.score || 0}</b> (${stats?.wins || 0}W/${stats?.losses || 0}L)`);
        }

        await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    },
};

