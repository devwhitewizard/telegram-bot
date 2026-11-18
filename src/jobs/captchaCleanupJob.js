const cron = require("node-cron");
const captchaRepository = require("../database/repositories/captchaRepository");
const { createChildLogger } = require("../utils/logger");

const jobLogger = createChildLogger("captchaCleanupJob");

/**
 * Process expired unverified CAPTCHA challenges:
 * - Removes (kicks) or keeps muted according to GroupSettings.captchaAction.
 * - Deletes the expired CAPTCHA prompt message.
 * - Cleans up the DB record so restarts never lose state.
 *
 * @param {import("telegraf").Telegraf} bot
 * @param {Date} [now=new Date()]
 * @returns {Promise<number>}
 */
async function processExpiredCaptchas(bot, now = new Date()) {
    const expired = await captchaRepository.findExpiredCaptchas(now);

    let processed = 0;
    for (const record of expired) {
        const chatId = Number(record.group.telegramId);
        const userId = Number(record.user.telegramId);
        const action = (record.group.settings?.captchaAction || "KICK").toUpperCase();

        if (action === "KICK") {
            try {
                await bot.telegram.banChatMember(chatId, userId);
                await bot.telegram.unbanChatMember(chatId, userId);
            } catch (err) {
                jobLogger.warn(
                    { err, chatId, userId },
                    "Failed to kick unverified user on CAPTCHA expiry"
                );
            }
        }

        if (record.messageId) {
            try {
                await bot.telegram.deleteMessage(chatId, record.messageId);
            } catch {
                // Ignore if message was already deleted
            }
        }

        await captchaRepository.deleteCaptcha(record.id);
        processed += 1;
    }

    return processed;
}

/**
 * Start the recurring cron job for expired CAPTCHA cleanup.
 */
function startCaptchaCleanupJob(bot, schedule = "*/30 * * * * *") {
    let isRunning = false;

    const task = cron.schedule(schedule, async () => {
        if (isRunning) {
            return;
        }
        isRunning = true;
        try {
            const count = await processExpiredCaptchas(bot);
            if (count > 0) {
                jobLogger.info({ count }, "Cleaned up expired CAPTCHA challenges");
            }
        } catch (err) {
            jobLogger.error({ err }, "Error in captchaCleanupJob");
        } finally {
            isRunning = false;
        }
    });

    return task;
}

module.exports = {
    processExpiredCaptchas,
    startCaptchaCleanupJob,
};

