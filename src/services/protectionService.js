const trustedUserRepository = require("../database/repositories/trustedUserRepository");
const settingsRepository = require("../database/repositories/settingsRepository");
const { createChildLogger } = require("../utils/logger");

const svcLogger = createChildLogger("protectionService");
const ADMIN_STATUSES = new Set(["creator", "administrator"]);
const ANONYMOUS_ADMIN_BOT_ID = 1087968824;

// Sliding window of join timestamps per group Telegram ID for anti-raid detection
const joinWindows = new Map();

/**
 * Determine whether a user is exempt from automated group protections
 * (group creator/admin, anonymous admin, or explicitly trusted user).
 *
 * @param {import("telegraf").Context} ctx
 * @param {number} groupId - Internal Group.id
 * @param {number | null} [userId] - Internal User.id
 * @returns {Promise<boolean>}
 */
async function isUserExempt(ctx, groupId, userId = null) {
    if (!ctx.from) {
        return true;
    }

    if (ctx.from.id === ANONYMOUS_ADMIN_BOT_ID && ctx.message?.sender_chat?.id === ctx.chat?.id) {
        return true;
    }

    if (userId && (await trustedUserRepository.isTrustedUser(groupId, userId))) {
        return true;
    }

    try {
        const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
        return Boolean(member && ADMIN_STATUSES.has(member.status));
    } catch (err) {
        svcLogger.warn(
            { err, chatId: ctx.chat?.id, userId: ctx.from.id },
            "Could not check exemption status via getChatMember"
        );
        return false;
    }
}

/**
 * Record new member joins and check whether the group's anti-raid threshold is exceeded.
 *
 * @param {object} group - Internal Group record
 * @param {object} settings - GroupSettings record
 * @param {number} [joinCount=1]
 * @param {number} [now=Date.now()]
 * @returns {Promise<{ raidTriggered: boolean, recentJoins: number }>}
 */
async function recordJoinsAndCheckRaid(group, settings, joinCount = 1, now = Date.now()) {
    if (!settings?.antiRaidEnabled) {
        return { raidTriggered: false, recentJoins: 0 };
    }

    const threshold = settings.raidJoinThreshold || 10;
    const windowMs = (settings.raidWindowSeconds || 30) * 1000;
    const key = String(group.telegramId);

    const existing = joinWindows.get(key) || [];
    const cutoff = now - windowMs;
    const recent = existing.filter((ts) => ts > cutoff);

    for (let i = 0; i < joinCount; i += 1) {
        recent.push(now);
    }

    joinWindows.set(key, recent);

    if (recent.length >= threshold && !settings.raidModeActive) {
        await settingsRepository.updateGroupSettings(group.id, {
            raidModeActive: true,
        });
        return { raidTriggered: true, recentJoins: recent.length };
    }

    return { raidTriggered: false, recentJoins: recent.length };
}

/**
 * Manually enable or disable raid mode for a group.
 * @param {number} groupId
 * @param {boolean} active
 */
async function setRaidMode(groupId, active) {
    return settingsRepository.updateGroupSettings(groupId, {
        raidModeActive: Boolean(active),
    });
}

/**
 * Reset in-memory join tracking (useful for tests).
 */
function clearJoinWindows() {
    joinWindows.clear();
}

module.exports = {
    isUserExempt,
    recordJoinsAndCheckRaid,
    setRaidMode,
    clearJoinWindows,
};

