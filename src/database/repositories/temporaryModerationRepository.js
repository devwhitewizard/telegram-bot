const { getPrisma } = require("../../config/database");
const { toPositiveInt } = require("./helpers");

/**
 * Create a temporary moderation record (MUTE or BAN) with an expiration timestamp.
 * Deactivates any previous active records of the same action for the same user in the group.
 *
 * @param {object} data
 * @param {number} data.groupId
 * @param {number} data.userId
 * @param {"MUTE" | "BAN"} data.action
 * @param {Date} data.expiresAt
 * @param {string | null} [data.reason]
 */
async function createTemporaryModeration({
    groupId,
    userId,
    action,
    expiresAt,
    reason = null,
}) {
    const prisma = getPrisma();
    const gId = toPositiveInt(groupId, "groupId");
    const uId = toPositiveInt(userId, "userId");
    const normalizedAction = String(action).trim().toUpperCase();

    if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
        throw new TypeError("expiresAt must be a valid Date");
    }

    return prisma.$transaction(async (tx) => {
        await tx.temporaryModeration.updateMany({
            where: {
                groupId: gId,
                userId: uId,
                action: normalizedAction,
                active: true,
            },
            data: { active: false },
        });

        return tx.temporaryModeration.create({
            data: {
                groupId: gId,
                userId: uId,
                action: normalizedAction,
                reason: reason ? String(reason).trim() : null,
                expiresAt,
                active: true,
            },
        });
    });
}

/**
 * Deactivate active temporary moderation records for a user and action (e.g., on manual /unmute or /unban).
 *
 * @param {number} groupId
 * @param {number} userId
 * @param {"MUTE" | "BAN"} action
 */
async function deactivateTemporaryModerations(groupId, userId, action) {
    const prisma = getPrisma();

    return prisma.temporaryModeration.updateMany({
        where: {
            groupId: toPositiveInt(groupId, "groupId"),
            userId: toPositiveInt(userId, "userId"),
            action: String(action).trim().toUpperCase(),
            active: true,
        },
        data: { active: false },
    });
}

/**
 * Find all active temporary moderation records that have expired as of `now`.
 *
 * @param {"MUTE" | "BAN"} action
 * @param {Date} [now=new Date()]
 */
async function findExpiredTemporaryModerations(action, now = new Date()) {
    const prisma = getPrisma();

    return prisma.temporaryModeration.findMany({
        where: {
            action: String(action).trim().toUpperCase(),
            active: true,
            expiresAt: { lte: now },
        },
        include: {
            group: true,
            user: true,
        },
        orderBy: { expiresAt: "asc" },
    });
}

/**
 * Mark a specific temporary moderation record as completed (inactive).
 *
 * @param {number} id
 */
async function markCompleted(id) {
    const prisma = getPrisma();

    return prisma.temporaryModeration.update({
        where: { id: toPositiveInt(id, "id") },
        data: { active: false },
    });
}

module.exports = {
    createTemporaryModeration,
    deactivateTemporaryModerations,
    findExpiredTemporaryModerations,
    markCompleted,
};

