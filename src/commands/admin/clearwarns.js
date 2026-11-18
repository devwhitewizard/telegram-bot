const warningService = require("../../services/warningService");
const { extractTargetUser } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "clearwarns",
    description: "Clear all warnings for a user",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const { target } = await extractTargetUser(ctx);
        if (!target) {
            await ctx.reply(
                "Please reply to a user's message or provide their Telegram user ID.\nUsage: /clearwarns"
            );
            return;
        }

        const { clearedCount } = await warningService.clearUserWarnings({
            groupId: ctx.state.group.id,
            targetTgUser: target,
            adminDbUser: ctx.state.user,
        });

        const name = escapeHtml(target.first_name || `User ${target.id}`);
        await ctx.reply(
            `🧹 Cleared ${clearedCount} warning(s) for <b>${name}</b>.`,
            { parse_mode: "HTML" }
        );
    },
};

