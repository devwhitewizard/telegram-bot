const warningRepository = require("../database/repositories/warningRepository");
const moderationRepository = require("../database/repositories/moderationRepository");
const moderationService = require("./moderationService");

/**
 * Issue a warning to a user and enforce the group's configurable warning threshold policy.
 * Uses a database transaction for warning creation + counting.
 */
async function warnUser({ ctx, group, settings, targetTgUser, adminDbUser, reason = null }) {
    const targetDbUser = await moderationService.ensureDbUser(targetTgUser);

    const { warning, totalWarnings } = await warningRepository.createWarningWithCount({
        groupId: group.id,
        userId: targetDbUser.id,
        issuedBy: adminDbUser.id,
        reason,
    });

    await moderationRepository.createModerationLog({
        groupId: group.id,
        targetUserId: targetDbUser.id,
        adminUserId: adminDbUser.id,
        action: "WARN",
        reason,
    });

    const maxWarnings = settings?.maxWarnings || 3;
    let autoAction = null;

    if (totalWarnings >= maxWarnings) {
        const policy = (settings?.warnAction || "MUTE").toUpperCase();
        const autoReason = `Reached warning threshold (${totalWarnings}/${maxWarnings})`;

        if (policy === "BAN") {
            await moderationService.banUser({
                ctx,
                group,
                targetTgUser,
                adminDbUser,
                reason: autoReason,
            });
            autoAction = { action: "BAN", reason: autoReason };
        } else if (policy === "KICK") {
            await moderationService.kickUser({
                ctx,
                group,
                targetTgUser,
                adminDbUser,
                reason: autoReason,
            });
            autoAction = { action: "KICK", reason: autoReason };
        } else {
            const muteMinutes = settings?.warnMuteMinutes || 60;
            const durationSeconds = muteMinutes * 60;
            await moderationService.muteUser({
                ctx,
                group,
                targetTgUser,
                adminDbUser,
                reason: autoReason,
                durationSeconds,
            });
            autoAction = {
                action: "MUTE",
                durationSeconds,
                reason: autoReason,
            };
        }

        await warningRepository.clearWarnings(group.id, targetDbUser.id);
    }

    return {
        warning,
        targetDbUser,
        totalWarnings,
        maxWarnings,
        autoAction,
    };
}

/**
 * Retrieve warning history for a user in a group.
 */
async function getUserWarnings(groupId, targetTgUser) {
    const targetDbUser = await moderationService.ensureDbUser(targetTgUser);
    const warnings = await warningRepository.getWarnings(groupId, targetDbUser.id);
    return { targetDbUser, warnings };
}

/**
 * Clear all warnings for a user in a group and record an audit log entry.
 */
async function clearUserWarnings({ groupId, targetTgUser, adminDbUser }) {
    const targetDbUser = await moderationService.ensureDbUser(targetTgUser);
    const result = await warningRepository.clearWarnings(groupId, targetDbUser.id);

    await moderationRepository.createModerationLog({
        groupId,
        targetUserId: targetDbUser.id,
        adminUserId: adminDbUser.id,
        action: "CLEARWARNS",
    });

    return { targetDbUser, clearedCount: result.count };
}

module.exports = {
    warnUser,
    getUserWarnings,
    clearUserWarnings,
};

