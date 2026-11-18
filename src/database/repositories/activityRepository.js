const { getPrisma } = require("../../config/database");
const { toPositiveInt } = require("./helpers");

/**
 * Flush a batch of message activity increments into UserActivity and DailyActivity
 * inside a single database transaction.
 *
 * @param {Array<{ groupId: number, userId: number, dateKey: string, count: number }>} entries
 */
async function incrementActivityBatch(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return;
    }

    const prisma = getPrisma();
    const dailyTotals = new Map();

    for (const entry of entries) {
        const dKey = `${entry.groupId}:${entry.dateKey}`;
        const prev = dailyTotals.get(dKey) || {
            groupId: toPositiveInt(entry.groupId, "groupId"),
            dateKey: entry.dateKey,
            count: 0,
        };
        prev.count += entry.count;
        dailyTotals.set(dKey, prev);
    }

    await prisma.$transaction(async (tx) => {
        const now = new Date();

        for (const entry of entries) {
            const gId = toPositiveInt(entry.groupId, "groupId");
            const uId = toPositiveInt(entry.userId, "userId");

            await tx.userActivity.upsert({
                where: { groupId_userId: { groupId: gId, userId: uId } },
                update: {
                    messageCount: { increment: entry.count },
                    lastActiveAt: now,
                },
                create: {
                    groupId: gId,
                    userId: uId,
                    messageCount: entry.count,
                    lastActiveAt: now,
                },
            });
        }

        for (const daily of dailyTotals.values()) {
            await tx.dailyActivity.upsert({
                where: {
                    groupId_dateKey: {
                        groupId: daily.groupId,
                        dateKey: daily.dateKey,
                    },
                },
                update: {
                    messageCount: { increment: daily.count },
                },
                create: {
                    groupId: daily.groupId,
                    dateKey: daily.dateKey,
                    messageCount: daily.count,
                },
            });
        }
    });
}

/**
 * Retrieve aggregate activity statistics for a group.
 * @param {number} groupId
 * @param {string} dateKey - YYYY-MM-DD
 */
async function getGroupStats(groupId, dateKey) {
    const prisma = getPrisma();
    const gId = toPositiveInt(groupId, "groupId");

    const [totals, today, trackedMembers] = await Promise.all([
        prisma.userActivity.aggregate({
            where: { groupId: gId },
            _sum: { messageCount: true },
        }),
        prisma.dailyActivity.findUnique({
            where: { groupId_dateKey: { groupId: gId, dateKey } },
        }),
        prisma.userActivity.count({
            where: { groupId: gId },
        }),
    ]);

    return {
        totalMessages: totals._sum.messageCount || 0,
        todayMessages: today?.messageCount || 0,
        trackedMembers,
    };
}

/**
 * Retrieve paginated top active members in a group.
 * @param {number} groupId
 * @param {{ limit?: number, offset?: number }} [options]
 */
async function getTopMembers(groupId, { limit = 10, offset = 0 } = {}) {
    const prisma = getPrisma();
    const gId = toPositiveInt(groupId, "groupId");
    const safeLimit = Math.min(Math.max(1, limit), 25);
    const safeOffset = Math.max(0, offset);

    const [rows, total] = await Promise.all([
        prisma.userActivity.findMany({
            where: { groupId: gId },
            include: { user: true },
            orderBy: { messageCount: "desc" },
            take: safeLimit,
            skip: safeOffset,
        }),
        prisma.userActivity.count({ where: { groupId: gId } }),
    ]);

    return { rows, total };
}

/**
 * Get a single user's activity in a group.
 * @param {number} groupId
 * @param {number} userId
 */
async function getUserActivity(groupId, userId) {
    const prisma = getPrisma();
    return prisma.userActivity.findUnique({
        where: {
            groupId_userId: {
                groupId: toPositiveInt(groupId, "groupId"),
                userId: toPositiveInt(userId, "userId"),
            },
        },
    });
}

module.exports = {
    incrementActivityBatch,
    getGroupStats,
    getTopMembers,
    getUserActivity,
};

