const moderationService = require("../../services/moderationService");
const { extractTargetUser } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "unban",
    description: "Unban a user from the group",
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
                "Please reply to a user's message or provide their Telegram user ID.\nUsage: /unban <user_id> [reason]"
            );
            return;
        }

        const validation = await moderationService.validateTarget(ctx, target.id, {
            allowMissing: true,
            protectAdmins: false,
        });
        if (!validation.ok) {
            await ctx.reply(validation.reason);
            return;
        }

        const reason = args.join(" ").trim() || null;

        await moderationService.unbanUser({
            ctx,
            group: ctx.state.group,
            targetTgUser: target,
            adminDbUser: ctx.state.user,
            reason,
        });

        const name = escapeHtml(target.first_name || `User ${target.id}`);
        await ctx.reply(`✅ Unbanned <b>${name}</b>.`, { parse_mode: "HTML" });
    },
};

