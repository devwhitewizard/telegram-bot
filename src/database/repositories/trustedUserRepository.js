const { getPrisma } = require("../../config/database");
const { toPositiveInt } = require("./helpers");

/**
 * Mark a user as trusted (exempt from automated group protections) in a group.
 * @param {number} groupId
 * @param {number} userId
 * @param {number | null} [addedBy]
 */
async function addTrustedUser(groupId, userId, addedBy = null) {
    const prisma = getPrisma();
    const gId = toPositiveInt(groupId, "groupId");
    const uId = toPositiveInt(userId, "userId");

    return prisma.trustedUser.upsert({
        where: {
            groupId_userId: { groupId: gId, userId: uId },
        },
        update: { addedBy },
        create: {
            groupId: gId,
            userId: uId,
            addedBy,
        },
    });
}

/**
 * Remove a user's trusted status in a group.
 * @param {number} groupId
 * @param {number} userId
 */
async function removeTrustedUser(groupId, userId) {
    const prisma = getPrisma();

    return prisma.trustedUser.deleteMany({
        where: {
            groupId: toPositiveInt(groupId, "groupId"),
            userId: toPositiveInt(userId, "userId"),
        },
    });
}

/**
 * Check if a user is trusted in a group.
 * @param {number} groupId
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function isTrustedUser(groupId, userId) {
    const prisma = getPrisma();

    const record = await prisma.trustedUser.findUnique({
        where: {
            groupId_userId: {
                groupId: toPositiveInt(groupId, "groupId"),
                userId: toPositiveInt(userId, "userId"),
            },
        },
    });

    return Boolean(record);
}

module.exports = {
    addTrustedUser,
    removeTrustedUser,
    isTrustedUser,
};

