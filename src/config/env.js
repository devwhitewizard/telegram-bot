const dotenv = require("dotenv");

// Load environment variables from .env file into process.env
dotenv.config({ quiet: true });

/**
 * Parse a boolean environment variable safely.
 * @param {string | undefined} value
 * @param {boolean} defaultValue
 * @returns {boolean}
 */
function parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === "") {
        return defaultValue;
    }
    return ["true", "1", "yes"].includes(String(value).trim().toLowerCase());
}

/**
 * Parse an integer environment variable safely.
 * @param {string | undefined} value
 * @param {number} defaultValue
 * @returns {number}
 */
function parseInteger(value, defaultValue) {
    if (value === undefined || value === "") {
        return defaultValue;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Load and validate application environment configuration.
 * Keeps secrets out of source code and fails fast on missing critical variables.
 *
 * @param {NodeJS.ProcessEnv} [sourceEnv=process.env]
 * @returns {Readonly<object>}
 */
function loadEnv(sourceEnv = process.env) {
    const nodeEnv = (sourceEnv.NODE_ENV || "development").trim();
    const botToken = (sourceEnv.BOT_TOKEN || "").trim();

    if (!botToken || botToken === "your_telegram_bot_token_here") {
        throw new Error(
            "Missing or invalid BOT_TOKEN environment variable. Please set BOT_TOKEN in your .env file."
        );
    }

    const webhookEnabled = parseBoolean(sourceEnv.WEBHOOK_ENABLED, false);
    const webhookDomain = (sourceEnv.WEBHOOK_DOMAIN || "").trim();

    if (webhookEnabled && !webhookDomain) {
        throw new Error(
            "WEBHOOK_DOMAIN is required when WEBHOOK_ENABLED is true."
        );
    }

    const aiProvider = (sourceEnv.AI_PROVIDER || "openai").trim().toLowerCase();
    const defaultAiBaseUrl =
        aiProvider === "openrouter"
            ? "https://openrouter.ai/api/v1"
            : "https://api.openai.com/v1";

    return Object.freeze({
        nodeEnv,
        isProduction: nodeEnv === "production",
        isDevelopment: nodeEnv === "development",
        isTest: nodeEnv === "test",
        botToken,
        botUsername: (sourceEnv.BOT_USERNAME || "").trim().replace(/^@/, ""),
        logLevel: (sourceEnv.LOG_LEVEL || "info").trim().toLowerCase(),
        logToFile: parseBoolean(sourceEnv.LOG_TO_FILE, false),
        databaseUrl: (sourceEnv.DATABASE_URL || "").trim(),
        webhook: Object.freeze({
            enabled: webhookEnabled,
            domain: webhookDomain,
            path: (sourceEnv.WEBHOOK_PATH || "/telegraf").trim(),
            port: parseInteger(sourceEnv.PORT, 3000),
        }),
        apis: Object.freeze({
            httpTimeoutMs: Math.max(1000, parseInteger(sourceEnv.HTTP_TIMEOUT_MS, 8000)),
            ai: Object.freeze({
                provider: aiProvider,
                apiKey: (sourceEnv.AI_API_KEY || "").trim(),
                model: (sourceEnv.AI_MODEL || "gpt-4o-mini").trim(),
                baseUrl: (sourceEnv.AI_BASE_URL || defaultAiBaseUrl).trim().replace(/\/+$/, ""),
                maxTokens: Math.max(50, parseInteger(sourceEnv.AI_MAX_TOKENS, 500)),
            }),
            news: Object.freeze({
                provider: (sourceEnv.NEWS_PROVIDER || "gnews").trim().toLowerCase(),
                apiKey: (sourceEnv.NEWS_API_KEY || "").trim(),
            }),
            translate: Object.freeze({
                provider: (sourceEnv.TRANSLATE_PROVIDER || "mymemory").trim().toLowerCase(),
                apiUrl: (sourceEnv.TRANSLATE_API_URL || "https://libretranslate.com/translate").trim(),
                apiKey: (sourceEnv.TRANSLATE_API_KEY || "").trim(),
            }),
            github: Object.freeze({
                token: (sourceEnv.GITHUB_TOKEN || "").trim(),
            }),
        }),
    });
}

const env = loadEnv();

module.exports = {
    env,
    loadEnv,
    parseBoolean,
    parseInteger,
};

