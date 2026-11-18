const startedAt = new Date();

const counters = {
    commandsExecutedTotal: 0,
    errorsTotal: 0,
    telegramApiErrorsTotal: 0,
    databaseErrorsTotal: 0,
    jobFailuresTotal: 0,
};

const commandCounts = new Map();
const jobStatuses = new Map();

function recordCommandUsage(commandName) {
    counters.commandsExecutedTotal += 1;
    const key = String(commandName || "unknown").toLowerCase();
    commandCounts.set(key, (commandCounts.get(key) || 0) + 1);
}

function recordError(err) {
    counters.errorsTotal += 1;
    if (err && (err.name === "TelegramError" || err.response?.error_code)) {
        counters.telegramApiErrorsTotal += 1;
    }
}

function recordDatabaseError() {
    counters.databaseErrorsTotal += 1;
}

function recordJobSuccess(jobName) {
    const now = new Date().toISOString();
    const prev = jobStatuses.get(jobName) || {};
    jobStatuses.set(jobName, {
        ...prev,
        status: "healthy",
        lastRunAt: now,
        lastSuccessAt: now,
        consecutiveFailures: 0,
        lastErrorMessage: null,
    });
}

function recordJobFailure(jobName, err) {
    counters.jobFailuresTotal += 1;
    const now = new Date().toISOString();
    const prev = jobStatuses.get(jobName) || {};
    const consecutiveFailures = (prev.consecutiveFailures || 0) + 1;

    jobStatuses.set(jobName, {
        ...prev,
        status: consecutiveFailures >= 3 ? "failing" : "degraded",
        lastRunAt: now,
        lastErrorAt: now,
        consecutiveFailures,
        lastErrorMessage: err?.message || "Unknown job error",
    });

    return consecutiveFailures;
}

function getMetricsSnapshot() {
    const topCommands = Array.from(commandCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([command, count]) => ({ command, count }));

    return {
        startedAt: startedAt.toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        ...counters,
        topCommands,
        jobs: Object.fromEntries(jobStatuses.entries()),
    };
}

function resetMetrics() {
    counters.commandsExecutedTotal = 0;
    counters.errorsTotal = 0;
    counters.telegramApiErrorsTotal = 0;
    counters.databaseErrorsTotal = 0;
    counters.jobFailuresTotal = 0;
    commandCounts.clear();
    jobStatuses.clear();
}

module.exports = {
    recordCommandUsage,
    recordError,
    recordDatabaseError,
    recordJobSuccess,
    recordJobFailure,
    getMetricsSnapshot,
    resetMetrics,
};

