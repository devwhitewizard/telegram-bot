const { getPrisma } = require("../../config/database");
const { toPositiveInt } = require("./helpers");

/**
 * Create a persisted game session in SQLite.
 */
async function createSession({
    groupId,
    hostUserId,
    gameType,
    state,
    messageId = null,
    expiresAt,
}) {
    const prisma = getPrisma();

    return prisma.gameSession.create({
        data: {
            groupId: toPositiveInt(groupId, "groupId"),
            hostUserId: toPositiveInt(hostUserId, "hostUserId"),
            gameType: String(gameType).trim().toUpperCase(),
            status: "ACTIVE",
            stateJson: JSON.stringify(state || {}),
            messageId,
            expiresAt,
        },
    });
}

/**
 * Find an active, non-expired session by ID.
 * @param {number} id
 */
async function findActiveSessionById(id) {
    const prisma = getPrisma();
    const session = await prisma.gameSession.findUnique({
        where: { id: toPositiveInt(id, "id") },
    });

    if (!session || session.status !== "ACTIVE") {
        return null;
    }

    if (new Date() > session.expiresAt) {
        await prisma.gameSession.update({
            where: { id: session.id },
            data: { status: "EXPIRED" },
        });
        return null;
    }

    return {
        ...session,
        state: JSON.parse(session.stateJson),
    };
}

/**
 * Find an active session in a group for a specific gameType (or any of several types).
 * @param {number} groupId
 * @param {string | string[]} gameTypes
 */
async function findActiveSession(groupId, gameTypes) {
    const prisma = getPrisma();
    const gId = toPositiveInt(groupId, "groupId");
    const types = Array.isArray(gameTypes)
        ? gameTypes.map((t) => String(t).trim().toUpperCase())
        : [String(gameTypes).trim().toUpperCase()];

    const session = await prisma.gameSession.findFirst({
        where: {
            groupId: gId,
            gameType: { in: types },
            status: "ACTIVE",
        },
        orderBy: { createdAt: "desc" },
    });

    if (!session) {
        return null;
    }

    if (new Date() > session.expiresAt) {
        await prisma.gameSession.update({
            where: { id: session.id },
            data: { status: "EXPIRED" },
        });
        return null;
    }

    return {
        ...session,
        state: JSON.parse(session.stateJson),
    };
}

/**
 * Update a session's JSON state (and optionally its messageId).
 */
async function updateSessionState(id, state, messageId = undefined) {
    const prisma = getPrisma();
    const data = { stateJson: JSON.stringify(state) };
    if (messageId !== undefined) {
        data.messageId = messageId;
    }

    return prisma.gameSession.update({
        where: { id: toPositiveInt(id, "id") },
        data,
    });
}

/**
 * Atomically complete a session only if it is currently ACTIVE.
 * Returns true if this call transitioned the session (prevents duplicate callbacks).
 */
async function completeSessionIfActive(id, status = "COMPLETED") {
    const prisma = getPrisma();
    const result = await prisma.gameSession.updateMany({
        where: {
            id: toPositiveInt(id, "id"),
            status: "ACTIVE",
        },
        data: { status },
    });

    return result.count > 0;
}

/**
 * Expire all overdue active game sessions across all groups.
 */
async function expireOverdueSessions(now = new Date()) {
    const prisma = getPrisma();
    const result = await prisma.gameSession.updateMany({
        where: {
            status: "ACTIVE",
            expiresAt: { lte: now },
        },
        data: { status: "EXPIRED" },
    });

    return result.count;
}

module.exports = {
    createSession,
    findActiveSessionById,
    findActiveSession,
    updateSessionState,
    completeSessionIfActive,
    expireOverdueSessions,
};

