const { getPrisma } = require("../config/database");
const metricsService = require("./metricsService");
const { createChildLogger } = require("../utils/logger");

const healthLogger = createChildLogger("healthService");

/**
 * Evaluate database connectivity, memory usage, uptime, and background job health.
 */
async function getHealthStatus() {
    const prisma = getPrisma();
    const dbStart = Date.now();
    let dbStatus = "up";
    let dbLatencyMs = 0;

    try {
        await prisma.$queryRaw`SELECT 1`;
        dbLatencyMs = Date.now() - dbStart;
    } catch (err) {
        dbStatus = "down";
        dbLatencyMs = Date.now() - dbStart;
        metricsService.recordDatabaseError();
        healthLogger.error({ err }, "Database health check failed");
    }

    const metrics = metricsService.getMetricsSnapshot();
    const hasFailingJob = Object.values(metrics.jobs).some(
        (job) => job.consecutiveFailures >= 3
    );

    const mem = process.memoryUsage();
    const status = dbStatus === "up" && !hasFailingJob ? "ok" : "degraded";

    return {
        status,
        timestamp: new Date().toISOString(),
        uptimeSeconds: metrics.uptimeSeconds,
        startedAt: metrics.startedAt,
        database: {
            status: dbStatus,
            latencyMs: dbLatencyMs,
        },
        memory: {
            rssMb: Math.round(mem.rss / 1024 / 1024),
            heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        },
        metrics: {
            commandsExecutedTotal: metrics.commandsExecutedTotal,
            errorsTotal: metrics.errorsTotal,
            telegramApiErrorsTotal: metrics.telegramApiErrorsTotal,
            databaseErrorsTotal: metrics.databaseErrorsTotal,
            jobFailuresTotal: metrics.jobFailuresTotal,
            topCommands: metrics.topCommands,
        },
        jobs: metrics.jobs,
    };
}

module.exports = {
    getHealthStatus,
};

