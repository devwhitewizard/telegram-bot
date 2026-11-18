const activityRepository = require("../database/repositories/activityRepository");
const { createChildLogger } = require("../utils/logger");

const svcLogger = createChildLogger("activityService");

// In-memory batch buffer: key -> { groupId, userId, dateKey, count }
const pendingBuffer = new Map();
const FLUSH_BATCH_SIZE = 20;

/**
 * Format a Date into UTC YYYY-MM-DD key.
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
function getDateKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

/**
 * Buffer a single message activity increment in memory.
 * Flushes to SQLite automatically once the buffer reaches FLUSH_BATCH_SIZE.
 */
async function recordMessageActivity(groupId, userId, date = new Date()) {
    const dateKey = getDateKey(date);
    const key = `${groupId}:${userId}:${dateKey}`;
    const existing = pendingBuffer.get(key);

    if (existing) {
        existing.count += 1;
    } else {
        pendingBuffer.set(key, { groupId, userId, dateKey, count: 1 });
    }

    if (pendingBuffer.size >= FLUSH_BATCH_SIZE) {
        await flushActivityBuffer();
    }
}

/**
 * Flush all buffered activity increments to SQLite in one transaction.
 */
async function flushActivityBuffer() {
    if (pendingBuffer.size === 0) {
        return 0;
    }

    const batch = Array.from(pendingBuffer.values());
    pendingBuffer.clear();

    try {
        await activityRepository.incrementActivityBatch(batch);
        return batch.length;
    } catch (err) {
        svcLogger.error({ err, batchSize: batch.length }, "Failed to flush activity buffer");
        return 0;
    }
}

/**
 * Retrieve group stats (flushing pending buffer first for up-to-date counts).
 */
async function getGroupStats(groupId) {
    await flushActivityBuffer();
    return activityRepository.getGroupStats(groupId, getDateKey());
}

/**
 * Retrieve paginated top active members.
 */
async function getTopMembers(groupId, { page = 1, pageSize = 10 } = {}) {
    await flushActivityBuffer();
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * pageSize;
    const result = await activityRepository.getTopMembers(groupId, {
        limit: pageSize,
        offset,
    });
    return {
        ...result,
        page: safePage,
        pageSize,
        totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
    };
}

/**
 * Clear in-memory buffer (for tests).
 */
function clearActivityBuffer() {
    pendingBuffer.clear();
}

module.exports = {
    getDateKey,
    recordMessageActivity,
    flushActivityBuffer,
    getGroupStats,
    getTopMembers,
    clearActivityBuffer,
};

