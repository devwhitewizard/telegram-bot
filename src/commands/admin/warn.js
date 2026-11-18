const moderationService = require("../../services/moderationService");
const warningService = require("../../services/warningService");
const { extractTargetUser } = require("../../utils/extractUser");
const { formatDuration } = require("../../utils/formatDuration");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "warn",
    description: "Issue a warning to a user (triggers automatic action at threshold)",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const permCheck = await moderationService.checkBotPermissions(ctx, [
            "can_restrict_members",
        ]);
        if (!permCheck.ok) {
            await ctx.reply(permCheck.reason);
            return;
        }

        const { target, args } = await extractTargetUser(ctx);
        if (!target) {
            await ctx.reply(
                "Please reply to a user's message or provide their Telegram user ID.\nUsage: /warn [reason]"
            );
            return;
        }

        const validation = await moderationService.validateTarget(ctx, target.id);
        if (!validation.ok) {
            await ctx.reply(validation.reason);
            return;
        }

        const reason = args.join(" ").trim() || null;

        const result = await warningService.warnUser({
            ctx,
            group: ctx.state.group,
            settings: ctx.state.groupSettings,
            targetTgUser: target,
            adminDbUser: ctx.state.user,
            reason,
        });

        const name = escapeHtml(target.first_name || `User ${target.id}`);
        let message = `⚠️ Warned <b>${name}</b> (${result.totalWarnings}/${result.maxWarnings}).`;
        if (reason) {
            message += `\nReason: ${escapeHtml(reason)}`;
        }
        if (result.autoAction) {
            const extra = result.autoAction.durationSeconds
                ? ` for ${formatDuration(result.autoAction.durationSeconds)}`
                : "";
            message += `\n\n🚨 Threshold reached! Automatic action: <b>${result.autoAction.action}</b>${extra}. Warnings have been reset.`;
        }

        await ctx.reply(message, { parse_mode: "HTML" });
    },
};

