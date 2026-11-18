const { getPrisma } = require("../../config/database");
const { toPositiveInt } = require("./helpers");

/**
 * Save a user's game score for a specific group and game.
 *
 * @param {object} data
 * @param {number} data.groupId
 * @param {number} data.userId
 * @param {string} data.game
 * @param {number} data.score
 */
async function saveGameScore({ groupId, userId, game, score }) {
    if (!game || typeof game !== "string") {
        throw new TypeError("game is required and must be a string");
    }
    if (!Number.isInteger(score)) {
        throw new TypeError("score must be an integer");
    }

    const prisma = getPrisma();

    return prisma.gameScore.create({
        data: {
            groupId: toPositiveInt(groupId, "groupId"),
            userId: toPositiveInt(userId, "userId"),
            game: game.trim().toLowerCase(),
            score,
        },
    });
}

/**
 * Retrieve the top aggregated scores for a game in a group.
 *
 * @param {number} groupId
 * @param {string} game
 * @param {number} [limit=10]
 */
async function getLeaderboard(groupId, game, limit = 10) {
    if (!game || typeof game !== "string") {
        throw new TypeError("game is required and must be a string");
    }

    const prisma = getPrisma();
    const id = toPositiveInt(groupId, "groupId");
    const normalizedGame = game.trim().toLowerCase();

    const grouped = await prisma.gameScore.groupBy({
        by: ["userId"],
        where: {
            groupId: id,
            game: normalizedGame,
        },
        _sum: {
            score: true,
        },
        orderBy: {
            _sum: {
                score: "desc",
            },
        },
        take: Math.min(Math.max(1, limit), 50),
    });

    if (grouped.length === 0) {
        return [];
    }

    const userIds = grouped.map((entry) => entry.userId);
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return grouped.map((entry) => ({
        userId: entry.userId,
        user: userMap.get(entry.userId) || null,
        totalScore: entry._sum.score || 0,
    }));
}

module.exports = {
    saveGameScore,
    getLeaderboard,
};

