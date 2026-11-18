const { getPrisma } = require("../../config/database");
const { toPositiveInt } = require("./helpers");

/**
 * Record a moderation action in the audit log.
 *
 * @param {object} data
 * @param {number} data.groupId
 * @param {number} data.targetUserId
 * @param {number} data.adminUserId
 * @param {string} data.action
 * @param {string | null} [data.reason]
 */
async function createModerationLog({
    groupId,
    targetUserId,
    adminUserId,
    action,
    reason = null,
    durationSeconds = null,
}) {
    if (!action || typeof action !== "string") {
        throw new TypeError("action is required and must be a string");
    }

    const prisma = getPrisma();

    return prisma.moderationLog.create({
        data: {
            groupId: toPositiveInt(groupId, "groupId"),
            targetUserId: toPositiveInt(targetUserId, "targetUserId"),
            adminUserId: toPositiveInt(adminUserId, "adminUserId"),
            action: action.trim().toUpperCase(),
            reason: reason ? String(reason).trim() : null,
            durationSeconds:
                Number.isInteger(durationSeconds) && durationSeconds > 0
                    ? durationSeconds
                    : null,
        },
    });
}

/**
 * Retrieve recent moderation logs for a group.
 *
 * @param {number} groupId
 * @param {object} [options]
 * @param {number} [options.limit=20]
 * @param {number} [options.offset=0]
 */
async function getModerationLogs(groupId, { limit = 20, offset = 0 } = {}) {
    const prisma = getPrisma();

    return prisma.moderationLog.findMany({
        where: { groupId: toPositiveInt(groupId, "groupId") },
        include: {
            targetUser: true,
            adminUser: true,
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(Math.max(1, limit), 100),
        skip: Math.max(0, offset),
    });
}

module.exports = {
    createModerationLog,
    getModerationLogs,
};

