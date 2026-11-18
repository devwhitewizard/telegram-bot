const scoreRepository = require("../database/repositories/scoreRepository");
const { getDateKey } = require("./activityService");

async function awardWin({ groupId, userId, game, points = 10, dailyKey = null }) {
    return scoreRepository.recordGameOutcome({
        groupId,
        userId,
        game,
        points,
        won: true,
        lost: false,
        dailyKey,
    });
}

async function recordLoss({ groupId, userId, game }) {
    return scoreRepository.recordGameOutcome({
        groupId,
        userId,
        game,
        points: 0,
        won: false,
        lost: true,
    });
}

async function getMyStats(groupId, userId) {
    return scoreRepository.getPlayerStats(groupId, userId);
}

async function getLeaderboard(groupId, { period = "all", page = 1, pageSize = 10 } = {}) {
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * pageSize;
    const rows = await scoreRepository.getGroupLeaderboard(groupId, {
        period,
        limit: pageSize,
        offset,
    });
    return { rows, period, page: safePage };
}

async function hasCompletedDailyToday(groupId, userId, date = new Date()) {
    const stats = await scoreRepository.getPlayerStats(groupId, userId);
    return stats?.lastDailyKey === getDateKey(date);
}

module.exports = {
    awardWin,
    recordLoss,
    getMyStats,
    getLeaderboard,
    hasCompletedDailyToday,
};

