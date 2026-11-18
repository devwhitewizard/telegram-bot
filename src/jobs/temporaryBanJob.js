const cron = require("node-cron");
const temporaryModerationRepository = require("../database/repositories/temporaryModerationRepository");
const { runMonitoredJob } = require("./jobMonitor");
const { createChildLogger } = require("../utils/logger");

const jobLogger = createChildLogger("temporaryBanJob");

/**
 * Process all expired temporary bans and unban the users in Telegram.
 *
 * @param {import("telegraf").Telegraf} bot
 * @param {Date} [now=new Date()]
 * @returns {Promise<number>}
 */
async function processExpiredBans(bot, now = new Date()) {
    const expired = await temporaryModerationRepository.findExpiredTemporaryModerations(
        "BAN",
        now
    );

    let processed = 0;
    for (const record of expired) {
        try {
            await bot.telegram.unbanChatMember(
                Number(record.group.telegramId),
                Number(record.user.telegramId),
                { only_if_banned: true }
            );
        } catch (err) {
            jobLogger.warn(
                {
                    err,
                    groupId: String(record.group.telegramId),
                    userId: String(record.user.telegramId),
                },
                "Could not unban user for expired temporary ban"
            );
        }

        await temporaryModerationRepository.markCompleted(record.id);
        processed += 1;
    }

    return processed;
}

/**
 * Start the recurring cron job for temporary ban expiration.
 */
function startTemporaryBanJob(bot, schedule = "*/30 * * * * *") {
    let isRunning = false;

    const task = cron.schedule(schedule, async () => {
        if (isRunning) {
            return;
        }
        isRunning = true;
        try {
            const count = await runMonitoredJob("temporaryBanJob", () =>
                processExpiredBans(bot)
            );
            if (count > 0) {
                jobLogger.info({ count }, "Processed expired temporary bans");
            }
        } finally {
            isRunning = false;
        }
    });

    return task;
}

module.exports = {
    processExpiredBans,
    startTemporaryBanJob,
};

