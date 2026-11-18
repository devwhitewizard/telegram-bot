const { getPrisma } = require("../../config/database");
const { toPositiveInt } = require("./helpers");

/**
 * Create a warning record for a user in a group.
 *
 * @param {object} data
 * @param {number} data.groupId - Internal Group.id
 * @param {number} data.userId - Internal User.id (warned user)
 * @param {number} data.issuedBy - Internal User.id (issuing admin)
 * @param {string | null} [data.reason]
 */
async function createWarning({ groupId, userId, issuedBy, reason = null }) {
    const prisma = getPrisma();

    return prisma.warning.create({
        data: {
            groupId: toPositiveInt(groupId, "groupId"),
            userId: toPositiveInt(userId, "userId"),
            issuedBy: toPositiveInt(issuedBy, "issuedBy"),
            reason: reason ? String(reason).trim() : null,
        },
        include: {
            user: true,
            issuer: true,
        },
    });
}

/**
 * Retrieve all warnings for a user in a group, ordered newest first.
 *
 * @param {number} groupId
 * @param {number} userId
 */
async function getWarnings(groupId, userId) {
    const prisma = getPrisma();

    return prisma.warning.findMany({
        where: {
            groupId: toPositiveInt(groupId, "groupId"),
            userId: toPositiveInt(userId, "userId"),
        },
        include: {
            issuer: true,
        },
        orderBy: { createdAt: "desc" },
    });
}

/**
 * Count warnings for a user in a group.
 *
 * @param {number} groupId
 * @param {number} userId
 * @returns {Promise<number>}
 */
async function countWarnings(groupId, userId) {
    const prisma = getPrisma();

    return prisma.warning.count({
        where: {
            groupId: toPositiveInt(groupId, "groupId"),
            userId: toPositiveInt(userId, "userId"),
        },
    });
}

/**
 * Clear all warnings for a user in a group.
 *
 * @param {number} groupId
 * @param {number} userId
 * @returns {Promise<{ count: number }>}
 */
async function clearWarnings(groupId, userId) {
    const prisma = getPrisma();

    return prisma.warning.deleteMany({
        where: {
            groupId: toPositiveInt(groupId, "groupId"),
            userId: toPositiveInt(userId, "userId"),
        },
    });
}

/**
 * Atomically create a warning and return both the warning and updated warning count.
 *
 * @param {object} data
 * @param {number} data.groupId
 * @param {number} data.userId
 * @param {number} data.issuedBy
 * @param {string | null} [data.reason]
 */
async function createWarningWithCount({ groupId, userId, issuedBy, reason = null }) {
    const prisma = getPrisma();
    const gId = toPositiveInt(groupId, "groupId");
    const uId = toPositiveInt(userId, "userId");
    const aId = toPositiveInt(issuedBy, "issuedBy");

    return prisma.$transaction(async (tx) => {
        const warning = await tx.warning.create({
            data: {
                groupId: gId,
                userId: uId,
                issuedBy: aId,
                reason: reason ? String(reason).trim() : null,
            },
            include: {
                user: true,
                issuer: true,
            },
        });

        const totalWarnings = await tx.warning.count({
            where: { groupId: gId, userId: uId },
        });

        return { warning, totalWarnings };
    });
}

module.exports = {
    createWarning,
    createWarningWithCount,
    getWarnings,
    countWarnings,
    clearWarnings,
};

