const { getPrisma } = require("../../config/database");
const { toPositiveInt } = require("./helpers");

/**
 * Record a game outcome (score, win/loss, streak, optional daily challenge key)
 * inside a single Prisma transaction.
 */
async function recordGameOutcome({
    groupId,
    userId,
    game,
    points = 0,
    won = false,
    lost = false,
    dailyKey = null,
}) {
    const prisma = getPrisma();
    const gId = toPositiveInt(groupId, "groupId");
    const uId = toPositiveInt(userId, "userId");

    return prisma.$transaction(async (tx) => {
        if (points !== 0) {
            await tx.gameScore.create({
                data: {
                    groupId: gId,
                    userId: uId,
                    game: String(game).trim().toLowerCase(),
                    score: points,
                },
            });
        }

        const existing = await tx.playerStats.findUnique({
            where: { groupId_userId: { groupId: gId, userId: uId } },
        });

        const prevStreak = existing?.streak || 0;
        const nextStreak = won ? prevStreak + 1 : lost ? 0 : prevStreak;
        const nextBestStreak = Math.max(existing?.bestStreak || 0, nextStreak);

        return tx.playerStats.upsert({
            where: { groupId_userId: { groupId: gId, userId: uId } },
            update: {
                score: { increment: points },
                wins: { increment: won ? 1 : 0 },
                losses: { increment: lost ? 1 : 0 },
                streak: nextStreak,
                bestStreak: nextBestStreak,
                ...(dailyKey ? { lastDailyKey: dailyKey } : {}),
            },
            create: {
                groupId: gId,
                userId: uId,
                score: Math.max(0, points),
                wins: won ? 1 : 0,
                losses: lost ? 1 : 0,
                streak: nextStreak,
                bestStreak: nextBestStreak,
                lastDailyKey: dailyKey,
            },
        });
    });
}

/**
 * Retrieve a player's aggregated stats in a group.
 */
async function getPlayerStats(groupId, userId) {
    const prisma = getPrisma();
    return prisma.playerStats.findUnique({
        where: {
            groupId_userId: {
                groupId: toPositiveInt(groupId, "groupId"),
                userId: toPositiveInt(userId, "userId"),
            },
        },
    });
}

/**
 * Retrieve group leaderboard for "all" (PlayerStats), "daily", or "weekly" (GameScore).
 */
async function getGroupLeaderboard(groupId, { period = "all", limit = 10, offset = 0 } = {}) {
    const prisma = getPrisma();
    const gId = toPositiveInt(groupId, "groupId");
    const safeLimit = Math.min(Math.max(1, limit), 25);
    const safeOffset = Math.max(0, offset);

    if (period === "daily" || period === "weekly") {
        const since = new Date();
        if (period === "daily") {
            since.setUTCHours(0, 0, 0, 0);
        } else {
            since.setUTCDate(since.getUTCDate() - 7);
        }

        const grouped = await prisma.gameScore.groupBy({
            by: ["userId"],
            where: {
                groupId: gId,
                createdAt: { gte: since },
            },
            _sum: { score: true },
            orderBy: { _sum: { score: "desc" } },
            take: safeLimit,
            skip: safeOffset,
        });

        if (grouped.length === 0) {
            return [];
        }

        const users = await prisma.user.findMany({
            where: { id: { in: grouped.map((g) => g.userId) } },
        });
        const userMap = new Map(users.map((u) => [u.id, u]));

        return grouped.map((g) => ({
            userId: g.userId,
            user: userMap.get(g.userId) || null,
            score: g._sum.score || 0,
        }));
    }

    const stats = await prisma.playerStats.findMany({
        where: { groupId: gId },
        include: { user: true },
        orderBy: [{ score: "desc" }, { wins: "desc" }],
        take: safeLimit,
        skip: safeOffset,
    });

    return stats.map((s) => ({
        userId: s.userId,
        user: s.user,
        score: s.score,
        wins: s.wins,
        losses: s.losses,
        streak: s.streak,
    }));
}

module.exports = {
    recordGameOutcome,
    getPlayerStats,
    getGroupLeaderboard,
};

