const cron = require("node-cron");
const temporaryModerationRepository = require("../database/repositories/temporaryModerationRepository");
const { RESTORED_PERMISSIONS } = require("../services/moderationService");
const { createChildLogger } = require("../utils/logger");

const jobLogger = createChildLogger("temporaryMuteJob");

/**
 * Process all expired temporary mutes and restore member permissions in Telegram.
 * Exported directly for unit testing and startup recovery.
 *
 * @param {import("telegraf").Telegraf} bot
 * @param {Date} [now=new Date()]
 * @returns {Promise<number>} Number of processed records
 */
async function processExpiredMutes(bot, now = new Date()) {
    const expired = await temporaryModerationRepository.findExpiredTemporaryModerations(
        "MUTE",
        now
    );

    let processed = 0;
    for (const record of expired) {
        try {
            await bot.telegram.restrictChatMember(
                Number(record.group.telegramId),
                Number(record.user.telegramId),
                { permissions: RESTORED_PERMISSIONS }
            );
        } catch (err) {
            jobLogger.warn(
                {
                    err,
                    groupId: String(record.group.telegramId),
                    userId: String(record.user.telegramId),
                },
                "Could not restore permissions for expired mute (user may have left)"
            );
        }

        await temporaryModerationRepository.markCompleted(record.id);
        processed += 1;
    }

    return processed;
}

/**
 * Start the recurring cron job for temporary mute expiration.
 * Prevents overlapping executions with an in-flight lock.
 *
 * @param {import("telegraf").Telegraf} bot
 * @param {string} [schedule="* * * * *"]
 */
function startTemporaryMuteJob(bot, schedule = "*/30 * * * * *") {
    let isRunning = false;

    const task = cron.schedule(schedule, async () => {
        if (isRunning) {
            return;
        }
        isRunning = true;
        try {
            const count = await processExpiredMutes(bot);
            if (count > 0) {
                jobLogger.info({ count }, "Processed expired temporary mutes");
            }
        } catch (err) {
            jobLogger.error({ err }, "Error in temporaryMuteJob");
        } finally {
            isRunning = false;
        }
    });

    return task;
}

module.exports = {
    processExpiredMutes,
    startTemporaryMuteJob,
};

