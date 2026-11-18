const metricsService = require("../services/metricsService");
const { createChildLogger } = require("../utils/logger");

const mwLogger = createChildLogger("errorMiddleware");

/**
 * Global Telegraf middleware that wraps downstream middleware & handlers.
 * Logs full error context internally (including Telegram API error codes)
 * while sending a safe generic message to Telegram users.
 *
 * @param {import("telegraf").Context} ctx
 * @param {() => Promise<void>} next
 */
async function errorMiddleware(ctx, next) {
    try {
        await next();
    } catch (err) {
        metricsService.recordError(err);

        const isTelegramError = Boolean(err?.name === "TelegramError" || err?.response?.error_code);
        mwLogger.error(
            {
                err,
                event: isTelegramError ? "telegram_api_error" : "unhandled_middleware_error",
                telegramErrorCode: err?.response?.error_code,
                telegramMethod: err?.on?.method,
                updateType: ctx?.updateType,
                chatId: ctx?.chat?.id,
                userId: ctx?.from?.id,
                text: ctx?.message?.text,
            },
            isTelegramError
                ? "Telegram API error during update processing"
                : "Middleware caught unhandled error"
        );

        try {
            if (ctx?.callbackQuery?.id) {
                await ctx.answerCbQuery("An error occurred. Please try again.", {
                    show_alert: false,
                });
            } else if (ctx?.chat?.id) {
                await ctx.reply("An unexpected error occurred. Please try again later.");
            }
        } catch (replyErr) {
            mwLogger.warn({ err: replyErr }, "Failed to notify user about error");
        }
    }
}

module.exports = errorMiddleware;

