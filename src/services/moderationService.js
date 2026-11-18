const userRepository = require("../database/repositories/userRepository");
const moderationRepository = require("../database/repositories/moderationRepository");
const temporaryModerationRepository = require("../database/repositories/temporaryModerationRepository");
const { createChildLogger } = require("../utils/logger");

const svcLogger = createChildLogger("moderationService");

const ADMIN_STATUSES = new Set(["creator", "administrator"]);

const MUTED_PERMISSIONS = Object.freeze({
    can_send_messages: false,
    can_send_audios: false,
    can_send_documents: false,
    can_send_photos: false,
    can_send_videos: false,
    can_send_video_notes: false,
    can_send_voice_notes: false,
    can_send_polls: false,
    can_send_other_messages: false,
    can_add_web_page_previews: false,
    can_change_info: false,
    can_invite_users: false,
    can_pin_messages: false,
});

const RESTORED_PERMISSIONS = Object.freeze({
    can_send_messages: true,
    can_send_audios: true,
    can_send_documents: true,
    can_send_photos: true,
    can_send_videos: true,
    can_send_video_notes: true,
    can_send_voice_notes: true,
    can_send_polls: true,
    can_send_other_messages: true,
    can_add_web_page_previews: true,
    can_invite_users: true,
});

/**
 * Ensure a Telegram user object is persisted in the database.
 * @param {object} tgUser
 */
async function ensureDbUser(tgUser) {
    return userRepository.upsertUser({
        telegramId: tgUser.id,
        username: tgUser.username || null,
        firstName: tgUser.first_name || `User ${tgUser.id}`,
        lastName: tgUser.last_name || null,
    });
}

/**
 * Verify that the bot is an administrator in the chat and holds all required permissions.
 *
 * @param {import("telegraf").Context} ctx
 * @param {string[]} [requiredFlags=[]]
 * @returns {Promise<{ ok: boolean, reason?: string, member?: object }>}
 */
async function checkBotPermissions(ctx, requiredFlags = []) {
    try {
        const botId = ctx.botInfo?.id || (await ctx.telegram.getMe()).id;
        const botMember = await ctx.telegram.getChatMember(ctx.chat.id, botId);

        if (!botMember || !ADMIN_STATUSES.has(botMember.status)) {
            return {
                ok: false,
                reason: "I must be a group administrator to perform this action.",
            };
        }

        if (botMember.status !== "creator") {
            for (const flag of requiredFlags) {
                if (!botMember[flag]) {
                    return {
                        ok: false,
                        reason: `I am missing the required "${flag}" administrator permission.`,
                    };
                }
            }
        }

        return { ok: true, member: botMember };
    } catch (err) {
        svcLogger.error({ err, chatId: ctx.chat?.id }, "Failed to check bot permissions");
        return {
            ok: false,
            reason: "Could not verify my administrator permissions in this group.",
        };
    }
}

/**
 * Validate a moderation target:
 * - Never target the bot itself.
 * - Never target the issuing user (unless allowSelf=true).
 * - Protect group owners and administrators.
 *
 * @param {import("telegraf").Context} ctx
 * @param {number | string | bigint} targetTelegramId
 * @param {object} [options]
 * @param {boolean} [options.allowSelf=false]
 * @param {boolean} [options.allowMissing=false]
 * @param {boolean} [options.protectAdmins=true]
 */
async function validateTarget(
    ctx,
    targetTelegramId,
    { allowSelf = false, allowMissing = false, protectAdmins = true } = {}
) {
    const botId = ctx.botInfo?.id || (await ctx.telegram.getMe()).id;
    const targetIdStr = String(targetTelegramId);

    if (targetIdStr === String(botId)) {
        return { ok: false, reason: "I cannot perform moderation actions on myself." };
    }

    if (!allowSelf && ctx.from && targetIdStr === String(ctx.from.id)) {
        return { ok: false, reason: "You cannot perform this action on yourself." };
    }

    try {
        const numericId = Number(targetTelegramId);
        const member = await ctx.telegram.getChatMember(ctx.chat.id, numericId);

        if (protectAdmins && member && ADMIN_STATUSES.has(member.status)) {
            return {
                ok: false,
                reason: "Group owners and administrators cannot be targeted by this command.",
            };
        }

        return { ok: true, member };
    } catch (err) {
        if (allowMissing) {
            return { ok: true, member: null };
        }
        svcLogger.warn(
            { err, chatId: ctx.chat?.id, targetTelegramId: targetIdStr },
            "Target user lookup failed"
        );
        return {
            ok: false,
            reason: "Could not find that user in this group (they may have left or deleted their account).",
        };
    }
}

/**
 * Ban a user from the group (optionally temporary if durationSeconds is provided).
 */
async function banUser({
    ctx,
    group,
    targetTgUser,
    adminDbUser,
    reason = null,
    durationSeconds = null,
}) {
    const targetDbUser = await ensureDbUser(targetTgUser);
    const numericTargetId = Number(targetTgUser.id);

    const extra = {};
    let expiresAt = null;

    if (durationSeconds && durationSeconds > 0) {
        // Telegram requires until_date to be > 30s and < 366d for temporary bans
        const clampedSeconds = Math.max(35, durationSeconds);
        expiresAt = new Date(Date.now() + clampedSeconds * 1000);
        extra.until_date = Math.floor(expiresAt.getTime() / 1000);
    }

    await ctx.telegram.banChatMember(ctx.chat.id, numericTargetId, extra);

    if (expiresAt) {
        await temporaryModerationRepository.createTemporaryModeration({
            groupId: group.id,
            userId: targetDbUser.id,
            action: "BAN",
            expiresAt,
            reason,
        });
    }

    await moderationRepository.createModerationLog({
        groupId: group.id,
        targetUserId: targetDbUser.id,
        adminUserId: adminDbUser.id,
        action: "BAN",
        reason,
        durationSeconds,
    });
    svcLogger.info(
        { event: "moderation_action", action: "BAN", groupId: group.id, targetUserId: targetDbUser.id, adminUserId: adminDbUser.id, durationSeconds },
        "Moderation action recorded"
    );

    return { targetDbUser, expiresAt };
}

/**
 * Unban a user from the group.
 */
async function unbanUser({ ctx, group, targetTgUser, adminDbUser, reason = null }) {
    const targetDbUser = await ensureDbUser(targetTgUser);
    const numericTargetId = Number(targetTgUser.id);

    await ctx.telegram.unbanChatMember(ctx.chat.id, numericTargetId, {
        only_if_banned: true,
    });

    await temporaryModerationRepository.deactivateTemporaryModerations(
        group.id,
        targetDbUser.id,
        "BAN"
    );

    await moderationRepository.createModerationLog({
        groupId: group.id,
        targetUserId: targetDbUser.id,
        adminUserId: adminDbUser.id,
        action: "UNBAN",
        reason,
    });

    return { targetDbUser };
}

/**
 * Kick a user (ban then immediately unban so they can rejoin via invite link).
 */
async function kickUser({ ctx, group, targetTgUser, adminDbUser, reason = null }) {
    const targetDbUser = await ensureDbUser(targetTgUser);
    const numericTargetId = Number(targetTgUser.id);

    await ctx.telegram.banChatMember(ctx.chat.id, numericTargetId);
    await ctx.telegram.unbanChatMember(ctx.chat.id, numericTargetId);

    await moderationRepository.createModerationLog({
        groupId: group.id,
        targetUserId: targetDbUser.id,
        adminUserId: adminDbUser.id,
        action: "KICK",
        reason,
    });

    return { targetDbUser };
}

/**
 * Mute a user in the group (indefinitely or for `durationSeconds`).
 */
async function muteUser({
    ctx,
    group,
    targetTgUser,
    adminDbUser,
    reason = null,
    durationSeconds = null,
}) {
    const targetDbUser = await ensureDbUser(targetTgUser);
    const numericTargetId = Number(targetTgUser.id);

    const extra = {
        permissions: MUTED_PERMISSIONS,
    };
    let expiresAt = null;

    if (durationSeconds && durationSeconds > 0) {
        expiresAt = new Date(Date.now() + durationSeconds * 1000);
        // Telegram only applies temporary until_date if >= 30s; our cron job also enforces exact expiry
        if (durationSeconds >= 30) {
            extra.until_date = Math.floor(expiresAt.getTime() / 1000);
        }
    }

    await ctx.telegram.restrictChatMember(ctx.chat.id, numericTargetId, extra);

    if (expiresAt) {
        await temporaryModerationRepository.createTemporaryModeration({
            groupId: group.id,
            userId: targetDbUser.id,
            action: "MUTE",
            expiresAt,
            reason,
        });
    }

    await moderationRepository.createModerationLog({
        groupId: group.id,
        targetUserId: targetDbUser.id,
        adminUserId: adminDbUser.id,
        action: "MUTE",
        reason,
        durationSeconds,
    });
    svcLogger.info(
        { event: "moderation_action", action: "MUTE", groupId: group.id, targetUserId: targetDbUser.id, adminUserId: adminDbUser.id, durationSeconds },
        "Moderation action recorded"
    );

    return { targetDbUser, expiresAt };
}

/**
 * Unmute a user by restoring standard group permissions.
 */
async function unmuteUser({ ctx, group, targetTgUser, adminDbUser, reason = null }) {
    const targetDbUser = await ensureDbUser(targetTgUser);
    const numericTargetId = Number(targetTgUser.id);

    await ctx.telegram.restrictChatMember(ctx.chat.id, numericTargetId, {
        permissions: RESTORED_PERMISSIONS,
    });

    await temporaryModerationRepository.deactivateTemporaryModerations(
        group.id,
        targetDbUser.id,
        "MUTE"
    );

    await moderationRepository.createModerationLog({
        groupId: group.id,
        targetUserId: targetDbUser.id,
        adminUserId: adminDbUser.id,
        action: "UNMUTE",
        reason,
    });

    return { targetDbUser };
}

/**
 * Promote a member to administrator with permissions bounded by the bot's own authority.
 */
async function promoteUser({ ctx, group, targetTgUser, adminDbUser, botMember }) {
    const targetDbUser = await ensureDbUser(targetTgUser);
    const numericTargetId = Number(targetTgUser.id);

    const isCreator = botMember?.status === "creator";
    await ctx.telegram.promoteChatMember(ctx.chat.id, numericTargetId, {
        can_manage_chat: true,
        can_delete_messages: isCreator || Boolean(botMember?.can_delete_messages),
        can_restrict_members: isCreator || Boolean(botMember?.can_restrict_members),
        can_invite_users: isCreator || Boolean(botMember?.can_invite_users),
        can_pin_messages: isCreator || Boolean(botMember?.can_pin_messages),
        can_manage_video_chats: isCreator || Boolean(botMember?.can_manage_video_chats),
        // Never grant promote/change_info unless bot itself holds them
        can_promote_members: false,
        can_change_info: false,
    });

    await moderationRepository.createModerationLog({
        groupId: group.id,
        targetUserId: targetDbUser.id,
        adminUserId: adminDbUser.id,
        action: "PROMOTE",
    });

    return { targetDbUser };
}

/**
 * Demote an administrator back to a regular member.
 */
async function demoteUser({ ctx, group, targetTgUser, adminDbUser }) {
    const targetDbUser = await ensureDbUser(targetTgUser);
    const numericTargetId = Number(targetTgUser.id);

    await ctx.telegram.promoteChatMember(ctx.chat.id, numericTargetId, {
        is_anonymous: false,
        can_manage_chat: false,
        can_delete_messages: false,
        can_manage_video_chats: false,
        can_restrict_members: false,
        can_promote_members: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false,
        can_post_stories: false,
        can_edit_stories: false,
        can_delete_stories: false,
    });

    await moderationRepository.createModerationLog({
        groupId: group.id,
        targetUserId: targetDbUser.id,
        adminUserId: adminDbUser.id,
        action: "DEMOTE",
    });

    return { targetDbUser };
}

/**
 * Fetch and sort group administrators (creator first).
 */
async function getGroupAdmins(ctx) {
    const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
    return admins.sort((a, b) => {
        if (a.status === "creator") return -1;
        if (b.status === "creator") return 1;
        return (a.user.first_name || "").localeCompare(b.user.first_name || "");
    });
}

module.exports = {
    MUTED_PERMISSIONS,
    RESTORED_PERMISSIONS,
    ensureDbUser,
    checkBotPermissions,
    validateTarget,
    banUser,
    unbanUser,
    kickUser,
    muteUser,
    unmuteUser,
    promoteUser,
    demoteUser,
    getGroupAdmins,
};

