const moderationService = require("../../services/moderationService");
const { extractTargetUser } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "demote",
    description: "Demote an administrator back to regular member",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const permCheck = await moderationService.checkBotPermissions(ctx, [
            "can_promote_members",
        ]);
        if (!permCheck.ok) {
            await ctx.reply(permCheck.reason);
            return;
        }

        const { target } = await extractTargetUser(ctx);
        if (!target) {
            await ctx.reply(
                "Please reply to a user's message or provide their Telegram user ID.\nUsage: /demote"
            );
            return;
        }

        const validation = await moderationService.validateTarget(ctx, target.id, {
            protectAdmins: false,
        });
        if (!validation.ok) {
            await ctx.reply(validation.reason);
            return;
        }

        if (validation.member?.status === "creator") {
            await ctx.reply("The group owner cannot be demoted.");
            return;
        }

        if (validation.member?.status !== "administrator") {
            await ctx.reply("That user is not an administrator.");
            return;
        }

        await moderationService.demoteUser({
            ctx,
            group: ctx.state.group,
            targetTgUser: target,
            adminDbUser: ctx.state.user,
        });

        const name = escapeHtml(target.first_name || `User ${target.id}`);
        await ctx.reply(`📉 Demoted <b>${name}</b> to regular member.`, {
            parse_mode: "HTML",
        });
    },
};

