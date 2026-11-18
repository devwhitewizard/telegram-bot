// Sliding-window trackers keyed by `${chatId}:${userId}`
const floodTracker = new Map();
const spamTracker = new Map();

const MAX_TRACKER_ENTRIES = 10_000;

/**
 * Prune expired entries when maps grow large.
 */
function pruneTracker(map, cutoffMs) {
    if (map.size <= MAX_TRACKER_ENTRIES) {
        return;
    }
    for (const [key, entries] of map.entries()) {
        const filtered = entries.filter((item) =>
            typeof item === "number" ? item > cutoffMs : item.ts > cutoffMs
        );
        if (filtered.length === 0) {
            map.delete(key);
        } else {
            map.set(key, filtered);
        }
    }
}

/**
 * Normalize message text for spam comparison (collapse whitespace, lowercase).
 * @param {string} text
 * @returns {string}
 */
function normalizeMessageText(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

/**
 * Record a message and check whether the user exceeded the anti-flood limit.
 *
 * @param {object} params
 * @param {number | string} params.chatId
 * @param {number | string} params.userId
 * @param {number} [params.maxMessages=5]
 * @param {number} [params.windowSeconds=5]
 * @param {number} [params.now=Date.now()]
 * @returns {{ isFlood: boolean, count: number }}
 */
function checkFlood({
    chatId,
    userId,
    maxMessages = 5,
    windowSeconds = 5,
    now = Date.now(),
}) {
    const key = `${chatId}:${userId}`;
    const windowMs = Math.max(1, windowSeconds) * 1000;
    const cutoff = now - windowMs;

    const history = (floodTracker.get(key) || []).filter((ts) => ts > cutoff);
    history.push(now);
    floodTracker.set(key, history);
    pruneTracker(floodTracker, cutoff);

    return {
        isFlood: history.length > maxMessages,
        count: history.length,
    };
}

/**
 * Record message content and check whether the user is sending repeated identical/near-identical spam.
 * Short trivial messages (e.g. "ok", "hi", emojis <= 2 chars) are ignored to avoid false positives.
 *
 * @param {object} params
 * @param {number | string} params.chatId
 * @param {number | string} params.userId
 * @param {string} params.text
 * @param {number} [params.threshold=3]
 * @param {number} [params.windowSeconds=30]
 * @param {number} [params.now=Date.now()]
 * @returns {{ isSpam: boolean, repeatCount: number }}
 */
function checkSpam({
    chatId,
    userId,
    text,
    threshold = 3,
    windowSeconds = 30,
    now = Date.now(),
}) {
    const normalized = normalizeMessageText(text);
    if (normalized.length < 3) {
        return { isSpam: false, repeatCount: 0 };
    }

    const key = `${chatId}:${userId}`;
    const windowMs = Math.max(1, windowSeconds) * 1000;
    const cutoff = now - windowMs;

    const history = (spamTracker.get(key) || []).filter((entry) => entry.ts > cutoff);
    history.push({ text: normalized, ts: now });
    spamTracker.set(key, history);
    pruneTracker(spamTracker, cutoff);

    const repeatCount = history.filter((entry) => entry.text === normalized).length;

    return {
        isSpam: repeatCount >= threshold,
        repeatCount,
    };
}

/**
 * Clear in-memory trackers (useful for unit tests).
 */
function clearTrackers() {
    floodTracker.clear();
    spamTracker.clear();
}

module.exports = {
    normalizeMessageText,
    checkFlood,
    checkSpam,
    clearTrackers,
};

