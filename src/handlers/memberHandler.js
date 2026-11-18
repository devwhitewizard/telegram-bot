const engagementService = require("../services/engagementService");
const { handleNewMembers: handleModerationJoin } = require("./moderationHandler");
const { createChildLogger } = require("../utils/logger");

const handlerLogger = createChildLogger("memberHandler");

/**
 * Handle new_chat_members for both Welcome messages and Anti-Raid / CAPTCHA.
 */
async function handleMemberJoin(ctx) {
    const group = ctx.state.group;
    const settings = ctx.state.groupSettings;
    const members = ctx.message?.new_chat_members;

    if (!group || !settings || !Array.isArray(members) || members.length === 0) {
        return;
    }

    // Run moderation/protection checks first (anti-raid / CAPTCHA)
    await handleModerationJoin(ctx);

    // If raid mode is active or CAPTCHA is enabled, skip normal welcome to avoid spam
    if (settings.raidModeActive || settings.captchaEnabled || !settings.welcomeEnabled) {
        return;
    }

    const humanMembers = members.filter((m) => !m.is_bot);
    if (humanMembers.length === 0) {
        return;
    }

    let memberCount = null;
    try {
        memberCount = await ctx.telegram.getChatMembersCount(ctx.chat.id);
    } catch {
        memberCount = null;
    }

    for (const member of humanMembers) {
        try {
            await engagementService.sendWelcomeMessage({
                ctx,
                settings,
                member,
                memberCount,
            });
        } catch (err) {
            handlerLogger.warn(
                { err, chatId: ctx.chat?.id, userId: member.id },
                "Failed to send welcome message"
            );
        }
    }
}

/**
 * Handle left_chat_member for Goodbye messages.
 * Ignores bot departures to avoid errors after being kicked/removed.
 */
async function handleMemberLeave(ctx) {
    const settings = ctx.state.groupSettings;
    const leftMember = ctx.message?.left_chat_member;

    if (!settings?.goodbyeEnabled || !leftMember || leftMember.is_bot) {
        return;
    }

    const botId = ctx.botInfo?.id;
    if (botId && String(leftMember.id) === String(botId)) {
        return;
    }

    try {
        await engagementService.sendGoodbyeMessage({
            ctx,
            settings,
            member: leftMember,
        });
    } catch (err) {
        handlerLogger.warn(
            { err, chatId: ctx.chat?.id, userId: leftMember.id },
            "Failed to send goodbye message"
        );
    }
}

function registerMemberHandlers(bot) {
    bot.on("new_chat_members", handleMemberJoin);
    bot.on("left_chat_member", handleMemberLeave);
}

module.exports = {
    handleMemberJoin,
    handleMemberLeave,
    registerMemberHandlers,
};

