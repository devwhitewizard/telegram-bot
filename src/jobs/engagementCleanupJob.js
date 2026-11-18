const cron = require("node-cron");
const activityService = require("../services/activityService");
const gameSessionRepository = require("../database/repositories/gameSessionRepository");
const { createChildLogger } = require("../utils/logger");

const jobLogger = createChildLogger("engagementCleanupJob");

/**
 * Flush buffered group activity to SQLite and expire overdue game sessions.
 */
async function runEngagementMaintenance(now = new Date()) {
    const flushed = await activityService.flushActivityBuffer();
    const expiredGames = await gameSessionRepository.expireOverdueSessions(now);
    return { flushed, expiredGames };
}

function startEngagementCleanupJob(schedule = "*/30 * * * * *") {
    let isRunning = false;

    return cron.schedule(schedule, async () => {
        if (isRunning) return;
        isRunning = true;
        try {
            const { expiredGames } = await runEngagementMaintenance();
            if (expiredGames > 0) {
                jobLogger.debug({ expiredGames }, "Expired overdue game sessions");
            }
        } catch (err) {
            jobLogger.error({ err }, "Error in engagementCleanupJob");
        } finally {
            isRunning = false;
        }
    });
}

module.exports = {
    runEngagementMaintenance,
    startEngagementCleanupJob,
};

