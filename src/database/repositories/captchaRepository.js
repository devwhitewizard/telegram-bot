const { getPrisma } = require("../../config/database");
const { toPositiveInt } = require("./helpers");

/**
 * Create or replace a pending CAPTCHA verification challenge for a user in a group.
 *
 * @param {object} data
 * @param {number} data.groupId
 * @param {number} data.userId
 * @param {string} data.expectedAnswer
 * @param {number | null} [data.messageId]
 * @param {Date} data.expiresAt
 */
async function upsertCaptcha({
    groupId,
    userId,
    expectedAnswer,
    messageId = null,
    expiresAt,
}) {
    const prisma = getPrisma();
    const gId = toPositiveInt(groupId, "groupId");
    const uId = toPositiveInt(userId, "userId");

    return prisma.captchaVerification.upsert({
        where: {
            groupId_userId: {
                groupId: gId,
                userId: uId,
            },
        },
        update: {
            expectedAnswer: String(expectedAnswer),
            messageId,
            expiresAt,
            verified: false,
        },
        create: {
            groupId: gId,
            userId: uId,
            expectedAnswer: String(expectedAnswer),
            messageId,
            expiresAt,
            verified: false,
        },
    });
}

/**
 * Update the stored Telegram message ID on an existing CAPTCHA record.
 * @param {number} id
 * @param {number} messageId
 */
async function setCaptchaMessageId(id, messageId) {
    const prisma = getPrisma();

    return prisma.captchaVerification.update({
        where: { id: toPositiveInt(id, "id") },
        data: { messageId },
    });
}

/**
 * Find a pending (unverified) CAPTCHA challenge for a user in a group.
 * @param {number} groupId
 * @param {number} userId
 */
async function findPendingCaptcha(groupId, userId) {
    const prisma = getPrisma();

    return prisma.captchaVerification.findFirst({
        where: {
            groupId: toPositiveInt(groupId, "groupId"),
            userId: toPositiveInt(userId, "userId"),
            verified: false,
        },
    });
}

/**
 * Mark a CAPTCHA challenge as verified.
 * @param {number} id
 */
async function markCaptchaVerified(id) {
    const prisma = getPrisma();

    return prisma.captchaVerification.update({
        where: { id: toPositiveInt(id, "id") },
        data: { verified: true },
    });
}

/**
 * Find all expired, unverified CAPTCHA challenges.
 * @param {Date} [now=new Date()]
 */
async function findExpiredCaptchas(now = new Date()) {
    const prisma = getPrisma();

    return prisma.captchaVerification.findMany({
        where: {
            verified: false,
            expiresAt: { lte: now },
        },
        include: {
            group: {
                include: { settings: true },
            },
            user: true,
        },
        orderBy: { expiresAt: "asc" },
    });
}

/**
 * Delete a CAPTCHA verification record by ID.
 * @param {number} id
 */
async function deleteCaptcha(id) {
    const prisma = getPrisma();

    return prisma.captchaVerification.deleteMany({
        where: { id: toPositiveInt(id, "id") },
    });
}

module.exports = {
    upsertCaptcha,
    setCaptchaMessageId,
    findPendingCaptcha,
    markCaptchaVerified,
    findExpiredCaptchas,
    deleteCaptcha,
};

