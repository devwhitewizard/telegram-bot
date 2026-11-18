const metricsService = require("../services/metricsService");
const { createChildLogger } = require("../utils/logger");

const monitorLogger = createChildLogger("jobMonitor");

/**
 * Execute a scheduled job function with structured failure tracking and consecutive-failure alerts.
 */
async function runMonitoredJob(jobName, fn) {
    try {
        const result = await fn();
        metricsService.recordJobSuccess(jobName);
        return result;
    } catch (err) {
        const consecutive = metricsService.recordJobFailure(jobName, err);
        const logMethod = consecutive >= 3 ? "fatal" : "error";
        monitorLogger[logMethod](
            { err, jobName, consecutiveFailures: consecutive },
            "Background job execution failed"
        );
        return null;
    }
}

module.exports = {
    runMonitoredJob,
};
