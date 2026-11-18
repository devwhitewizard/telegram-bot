const UNIT_SECONDS = {
    s: 1,
    sec: 1,
    secs: 1,
    second: 1,
    seconds: 1,
    m: 60,
    min: 60,
    mins: 60,
    minute: 60,
    minutes: 60,
    h: 3600,
    hr: 3600,
    hrs: 3600,
    hour: 3600,
    hours: 3600,
    d: 86400,
    day: 86400,
    days: 86400,
    w: 604800,
    week: 604800,
    weeks: 604800,
};

/**
 * Parse a human-readable duration string (e.g. "10m", "2h", "1d", "30s") into seconds.
 * Returns null if the input is not a valid positive duration.
 *
 * @param {string | undefined | null} input
 * @returns {number | null}
 */
function parseDuration(input) {
    if (!input || typeof input !== "string") {
        return null;
    }

    const match = input.trim().toLowerCase().match(/^(\d+)\s*([a-z]+)$/);
    if (!match) {
        return null;
    }

    const amount = Number.parseInt(match[1], 10);
    const unitMultiplier = UNIT_SECONDS[match[2]];

    if (!Number.isFinite(amount) || amount <= 0 || !unitMultiplier) {
        return null;
    }

    return amount * unitMultiplier;
}

/**
 * Format a duration in seconds into a human-readable string.
 *
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatDuration(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
        return "0 seconds";
    }

    const seconds = Math.floor(totalSeconds);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
    if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
    if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
    if (secs > 0 && parts.length === 0) {
        parts.push(`${secs} ${secs === 1 ? "second" : "seconds"}`);
    }

    return parts.join(", ");
}

module.exports = {
    parseDuration,
    formatDuration,
};

