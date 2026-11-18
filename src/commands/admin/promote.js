const moderationService = require("../../services/moderationService");
const { extractTargetUser } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "promote",
    description: "Promote a group member to administrator",
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
                "Please reply to a user's message or provide their Telegram user ID.\nUsage: /promote"
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

        if (
            validation.member &&
            (validation.member.status === "creator" ||
                validation.member.status === "administrator")
        ) {
            await ctx.reply("That user is already a group administrator.");
            return;
        }

        await moderationService.promoteUser({
            ctx,
            group: ctx.state.group,
            targetTgUser: target,
            adminDbUser: ctx.state.user,
            botMember: permCheck.member,
        });

        const name = escapeHtml(target.first_name || `User ${target.id}`);
        await ctx.reply(`⭐ Promoted <b>${name}</b> to administrator.`, {
            parse_mode: "HTML",
        });
    },
};

