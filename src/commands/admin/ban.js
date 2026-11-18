const moderationService = require("../../services/moderationService");
const { extractTargetUser } = require("../../utils/extractUser");
const { parseDuration, formatDuration } = require("../../utils/formatDuration");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "ban",
    description: "Ban a user from the group (supports optional duration and reason)",
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
                "Please reply to a user's message or provide their Telegram user ID.\nUsage: /ban [duration] [reason]"
            );
            return;
        }

        const validation = await moderationService.validateTarget(ctx, target.id, {
            allowMissing: true,
        });
        if (!validation.ok) {
            await ctx.reply(validation.reason);
            return;
        }

        let durationSeconds = null;
        let reasonArgs = args;
        if (args.length > 0) {
            const parsed = parseDuration(args[0]);
            if (parsed) {
                durationSeconds = parsed;
                reasonArgs = args.slice(1);
            }
        }
        const reason = reasonArgs.join(" ").trim() || null;

        await moderationService.banUser({
            ctx,
            group: ctx.state.group,
            targetTgUser: target,
            adminDbUser: ctx.state.user,
            reason,
            durationSeconds,
        });

        const name = escapeHtml(target.first_name || `User ${target.id}`);
        const durationText = durationSeconds
            ? ` for ${formatDuration(durationSeconds)}`
            : " permanently";
        const reasonText = reason ? `\nReason: ${escapeHtml(reason)}` : "";

        await ctx.reply(`🔨 Banned <b>${name}</b>${durationText}.${reasonText}`, {
            parse_mode: "HTML",
        });
    },
};

