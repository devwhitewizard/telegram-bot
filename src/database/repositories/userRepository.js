const { getPrisma } = require("../../config/database");
const { toBigIntId } = require("./helpers");

/**
 * Create a new user or update profile fields if the Telegram user already exists.
 *
 * @param {object} data
 * @param {number | string | bigint} data.telegramId
 * @param {string | null} [data.username]
 * @param {string} data.firstName
 * @param {string | null} [data.lastName]
 */
async function createUser({ telegramId, username = null, firstName, lastName = null }) {
    if (!firstName || typeof firstName !== "string") {
        throw new TypeError("firstName is required and must be a string");
    }

    const prisma = getPrisma();
    const tgId = toBigIntId(telegramId, "telegramId");

    return prisma.user.upsert({
        where: { telegramId: tgId },
        update: {
            username: username || null,
            firstName: firstName.trim(),
            lastName: lastName ? lastName.trim() : null,
        },
        create: {
            telegramId: tgId,
            username: username || null,
            firstName: firstName.trim(),
            lastName: lastName ? lastName.trim() : null,
        },
    });
}

/**
 * Find a user by their Telegram ID.
 *
 * @param {number | string | bigint} telegramId
 */
async function findUserByTelegramId(telegramId) {
    const prisma = getPrisma();
    const tgId = toBigIntId(telegramId, "telegramId");

    return prisma.user.findUnique({
        where: { telegramId: tgId },
    });
}

module.exports = {
    createUser,
    upsertUser: createUser,
    findUserByTelegramId,
};

