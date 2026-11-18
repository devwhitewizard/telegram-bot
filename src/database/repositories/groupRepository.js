const { getPrisma } = require("../../config/database");
const { toBigIntId } = require("./helpers");

/**
 * Register a Telegram group or update its metadata if already registered.
 * Automatically initializes default GroupSettings on creation.
 *
 * @param {object} data
 * @param {number | string | bigint} data.telegramId
 * @param {string} data.title
 * @param {string | null} [data.username]
 * @param {string} data.type
 */
async function registerGroup({ telegramId, title, username = null, type }) {
    if (!title || typeof title !== "string") {
        throw new TypeError("title is required and must be a string");
    }
    if (!type || typeof type !== "string") {
        throw new TypeError("type is required and must be a string");
    }

    const prisma = getPrisma();
    const tgId = toBigIntId(telegramId, "telegramId");

    return prisma.group.upsert({
        where: { telegramId: tgId },
        update: {
            title: title.trim(),
            username: username || null,
            type: type.trim(),
            settings: {
                upsert: {
                    create: {},
                    update: {},
                },
            },
        },
        create: {
            telegramId: tgId,
            title: title.trim(),
            username: username || null,
            type: type.trim(),
            settings: {
                create: {},
            },
        },
        include: {
            settings: true,
        },
    });
}

/**
 * Find a group by its Telegram chat ID, including its settings.
 *
 * @param {number | string | bigint} telegramId
 */
async function findGroupByTelegramId(telegramId) {
    const prisma = getPrisma();
    const tgId = toBigIntId(telegramId, "telegramId");

    return prisma.group.findUnique({
        where: { telegramId: tgId },
        include: {
            settings: true,
        },
    });
}

module.exports = {
    registerGroup,
    findGroupByTelegramId,
};

