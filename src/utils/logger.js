const fs = require("fs");
const path = require("path");
const pino = require("pino");
const { env } = require("../config/env");

const LOG_DIR = path.resolve(process.cwd(), "logs");
const LOG_FILE_PATH = path.join(LOG_DIR, "app.log");

/**
 * Build Pino transport targets based on environment configuration.
 * - Development: pretty-prints to stdout if pino-pretty is installed.
 * - Optional file logging: writes JSON logs to logs/app.log when LOG_TO_FILE=true.
 */
function buildTransport() {
    const targets = [];

    if (!env.isProduction && !env.isTest) {
        try {
            require.resolve("pino-pretty");
            targets.push({
                target: "pino-pretty",
                level: env.logLevel,
                options: {
                    colorize: true,
                    translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
                    ignore: "pid,hostname",
                },
            });
        } catch {
            targets.push({
                target: "pino/file",
                level: env.logLevel,
                options: { destination: 1 },
            });
        }
    } else {
        targets.push({
            target: "pino/file",
            level: env.logLevel,
            options: { destination: 1 },
        });
    }

    if (env.logToFile) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
        targets.push({
            target: "pino/file",
            level: env.logLevel,
            options: { destination: LOG_FILE_PATH, mkdir: true },
        });
    }

    return pino.transport({ targets });
}

const logger = pino(
    {
        level: env.isTest ? "silent" : env.logLevel,
        base: {
            service: "telegram-group-bot",
            env: env.nodeEnv,
        },
        redact: {
            paths: [
                "botToken",
                "token",
                "password",
                "authorization",
                "headers.authorization",
                "headers.Authorization",
                "headers['x-api-key']",
                "apiKey",
                "aiApiKey",
                "newsApiKey",
                "githubToken",
                "databaseUrl",
            ],
            censor: "[REDACTED]",
        },
        timestamp: pino.stdTimeFunctions.isoTime,
    },
    env.isTest ? undefined : buildTransport()
);

/**
 * Create a module-scoped child logger.
 * @param {string} moduleName
 * @param {Record<string, unknown>} [extra]
 * @returns {import("pino").Logger}
 */
function createChildLogger(moduleName, extra = {}) {
    return logger.child({ module: moduleName, ...extra });
}

module.exports = {
    logger,
    createChildLogger,
};

