const { env } = require("./config/env");
const botConfig = require("./config/botConfig");
const { initDatabase, disconnectDatabase } = require("./config/database");
const { createBot } = require("./bot");
const {
    processExpiredMutes,
    startTemporaryMuteJob,
} = require("./jobs/temporaryMuteJob");
const {
    processExpiredBans,
    startTemporaryBanJob,
} = require("./jobs/temporaryBanJob");
const {
    processExpiredCaptchas,
    startCaptchaCleanupJob,
} = require("./jobs/captchaCleanupJob");
const {
    runEngagementMaintenance,
    startEngagementCleanupJob,
} = require("./jobs/engagementCleanupJob");
const { flushActivityBuffer } = require("./services/activityService");
const { createChildLogger } = require("./utils/logger");

const appLogger = createChildLogger("bootstrap");

let botInstance = null;
let scheduledJobs = [];
let isShuttingDown = false;

/**
 * Gracefully stop scheduled jobs, the bot, and the database connection.
 * @param {string} signal
 * @param {number} [exitCode=0]
 */
async function shutdown(signal, exitCode = 0) {
    if (isShuttingDown) {
        return;
    }
    isShuttingDown = true;

    appLogger.info({ signal }, "Shutting down bot gracefully...");

    try {
        for (const job of scheduledJobs) {
            if (job && typeof job.stop === "function") {
                job.stop();
            }
        }
        scheduledJobs = [];

        if (botInstance) {
            botInstance.stop(signal);
        }
        await flushActivityBuffer();
        await disconnectDatabase();
        appLogger.info("Bot and database stopped cleanly");
        process.exit(exitCode);
    } catch (err) {
        appLogger.error({ err }, "Error during graceful shutdown");
        process.exit(1);
    }
}

/**
 * Initialize database, configure bot, recover pending jobs, and start receiving updates.
 */
async function bootstrap() {
    appLogger.info(
        {
            name: botConfig.name,
            version: botConfig.version,
            env: env.nodeEnv,
            mode: env.webhook.enabled ? "webhook" : "polling",
        },
        "Starting application..."
    );

    await initDatabase();

    botInstance = createBot();

    const commandsToSync =
        botInstance.menuCommands && botInstance.menuCommands.length > 0
            ? botInstance.menuCommands
            : botConfig.defaultCommands;

    try {
        await botInstance.telegram.setMyCommands(commandsToSync);
        appLogger.info(
            { count: commandsToSync.length },
            "Telegram command menu synchronized"
        );
    } catch (err) {
        appLogger.warn({ err }, "Failed to synchronize Telegram command menu");
    }

    // Run immediate startup recovery for expired mutes/bans/captchas persisted before restart
    await Promise.allSettled([
        processExpiredMutes(botInstance),
        processExpiredBans(botInstance),
        processExpiredCaptchas(botInstance),
        runEngagementMaintenance(),
    ]);

    // Start background cron jobs
    scheduledJobs = [
        startTemporaryMuteJob(botInstance),
        startTemporaryBanJob(botInstance),
        startCaptchaCleanupJob(botInstance),
        startEngagementCleanupJob(),
    ];
    appLogger.info({ jobCount: scheduledJobs.length }, "Scheduled moderation jobs started");

    if (env.webhook.enabled) {
        await botInstance.launch({
            webhook: {
                domain: env.webhook.domain,
                hookPath: env.webhook.path,
                port: env.webhook.port,
            },
            dropPendingUpdates: botConfig.polling.dropPendingUpdates,
            allowedUpdates: botConfig.polling.allowedUpdates,
        });
        appLogger.info(
            {
                domain: env.webhook.domain,
                path: env.webhook.path,
                port: env.webhook.port,
            },
            "Bot launched in webhook mode"
        );
    } else {
        await botInstance.launch({
            dropPendingUpdates: botConfig.polling.dropPendingUpdates,
            allowedUpdates: botConfig.polling.allowedUpdates,
        });
        appLogger.info("Bot launched in long-polling mode");
    }
}

// Process-level safety handlers
process.once("SIGINT", () => shutdown("SIGINT", 0));
process.once("SIGTERM", () => shutdown("SIGTERM", 0));

process.on("unhandledRejection", (reason) => {
    appLogger.error({ err: reason }, "Unhandled Promise Rejection");
});

process.on("uncaughtException", (err) => {
    appLogger.fatal({ err }, "Uncaught Exception");
    shutdown("UNCAUGHT_EXCEPTION", 1);
});

if (require.main === module) {
    bootstrap().catch(async (err) => {
        appLogger.fatal({ err }, "Failed to start bot");
        await disconnectDatabase();
        process.exit(1);
    });
}

module.exports = {
    bootstrap,
    shutdown,
};
