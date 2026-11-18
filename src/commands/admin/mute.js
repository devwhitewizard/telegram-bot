const moderationService = require("../../services/moderationService");
const { extractTargetUser } = require("../../utils/extractUser");
const { parseDuration, formatDuration } = require("../../utils/formatDuration");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "mute",
    description: "Restrict a user from sending messages (supports duration like 10m, 2h, 1d)",
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
                "Please reply to a user's message or provide their Telegram user ID.\nUsage: /mute [duration] [reason]"
            );
            return;
        }

        const validation = await moderationService.validateTarget(ctx, target.id);
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

        await moderationService.muteUser({
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
            : " indefinitely";
        const reasonText = reason ? `\nReason: ${escapeHtml(reason)}` : "";

        await ctx.reply(`🔇 Muted <b>${name}</b>${durationText}.${reasonText}`, {
            parse_mode: "HTML",
        });
    },
};

