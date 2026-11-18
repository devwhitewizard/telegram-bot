const { getPrisma } = require("../../config/database");
const { toPositiveInt } = require("./helpers");

/**
 * Normalize a blocked word to lowercase trimmed form.
 * @param {string} word
 * @returns {string}
 */
function normalizeWord(word) {
    if (!word || typeof word !== "string") {
        throw new TypeError("word is required and must be a string");
    }
    const cleaned = word.trim().toLowerCase();
    if (!cleaned) {
        throw new TypeError("word cannot be empty");
    }
    return cleaned;
}

/**
 * Add a blocked word for a group (idempotent).
 * @param {number} groupId
 * @param {string} word
 */
async function addBlockedWord(groupId, word) {
    const prisma = getPrisma();
    const gId = toPositiveInt(groupId, "groupId");
    const normalized = normalizeWord(word);

    return prisma.blockedWord.upsert({
        where: {
            groupId_word: {
                groupId: gId,
                word: normalized,
            },
        },
        update: {},
        create: {
            groupId: gId,
            word: normalized,
        },
    });
}

/**
 * Remove a blocked word from a group.
 * @param {number} groupId
 * @param {string} word
 */
async function removeBlockedWord(groupId, word) {
    const prisma = getPrisma();
    const gId = toPositiveInt(groupId, "groupId");
    const normalized = normalizeWord(word);

    return prisma.blockedWord.deleteMany({
        where: {
            groupId: gId,
            word: normalized,
        },
    });
}

/**
 * List all blocked words for a group.
 * @param {number} groupId
 */
async function listBlockedWords(groupId) {
    const prisma = getPrisma();

    return prisma.blockedWord.findMany({
        where: { groupId: toPositiveInt(groupId, "groupId") },
        orderBy: { word: "asc" },
    });
}

module.exports = {
    addBlockedWord,
    removeBlockedWord,
    listBlockedWords,
};

