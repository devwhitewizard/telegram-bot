const { PrismaClient } = require("@prisma/client");
const { env } = require("./env");
const { createChildLogger } = require("../utils/logger");

const dbLogger = createChildLogger("database");

let prismaInstance = null;

/**
 * Create or return the singleton PrismaClient instance.
 * Prevents opening multiple connection pools across the application.
 *
 * @returns {import("@prisma/client").PrismaClient}
 */
function getPrisma() {
    if (!prismaInstance) {
        prismaInstance = new PrismaClient({
            log: env.isDevelopment
                ? [
                      { emit: "event", level: "warn" },
                      { emit: "event", level: "error" },
                  ]
                : [{ emit: "event", level: "error" }],
        });

        prismaInstance.$on("warn", (event) => {
            dbLogger.warn({ target: event.target }, event.message);
        });

        prismaInstance.$on("error", (event) => {
            dbLogger.error({ target: event.target }, event.message);
        });
    }

    return prismaInstance;
}

/**
 * Connect to the database and verify connectivity.
 * @returns {Promise<import("@prisma/client").PrismaClient>}
 */
async function initDatabase() {
    const prisma = getPrisma();
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    dbLogger.info("Database connection initialized");
    return prisma;
}

/**
 * Gracefully disconnect the Prisma client during shutdown.
 * @returns {Promise<void>}
 */
async function disconnectDatabase() {
    if (!prismaInstance) {
        return;
    }

    try {
        await prismaInstance.$disconnect();
        dbLogger.info("Database connection closed");
    } finally {
        prismaInstance = null;
    }
}

module.exports = {
    getPrisma,
    initDatabase,
    disconnectDatabase,
};

