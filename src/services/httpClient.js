const axios = require("axios");
const { env } = require("../config/env");
const { createChildLogger } = require("../utils/logger");

const httpLogger = createChildLogger("httpClient");

const RETRYABLE_NETWORK_CODES = new Set([
    "ECONNRESET",
    "ECONNABORTED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
]);
const RETRYABLE_HTTP_STATUS = new Set([502, 503, 504]);

class HttpClientError extends Error {
    constructor(message, { code = "PROVIDER_ERROR", status = null } = {}) {
        super(message);
        this.name = "HttpClientError";
        this.code = code;
        this.status = status;
    }
}

/**
 * Strip query parameters from a URL before logging so secret query keys are never leaked.
 */
function sanitizeUrlForLog(rawUrl) {
    try {
        const parsed = new URL(rawUrl);
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return "[invalid-url]";
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an external HTTP request with timeout, safe error mapping,
 * and limited retries ONLY for idempotent GET requests on transient failures.
 */
async function request(config, { retries = 2, timeoutMs = env.apis.httpTimeoutMs } = {}) {
    const method = (config.method || "GET").toUpperCase();
    const canRetry = method === "GET";
    const maxAttempts = canRetry ? Math.max(1, retries + 1) : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            const response = await axios.request({
                timeout: timeoutMs,
                ...config,
                method,
                headers: {
                    "User-Agent": "telegram-group-bot/1.0.0",
                    Accept: "application/json",
                    ...(config.headers || {}),
                },
            });
            return response.data;
        } catch (err) {
            const status = err.response?.status || null;
            const netCode = err.code || null;

            const isTimeout =
                netCode === "ECONNABORTED" ||
                netCode === "ETIMEDOUT" ||
                /timeout/i.test(err.message || "");

            const shouldRetry =
                attempt < maxAttempts &&
                (RETRYABLE_NETWORK_CODES.has(netCode) || RETRYABLE_HTTP_STATUS.has(status));

            if (shouldRetry) {
                await sleep(250 * attempt);
                continue;
            }

            httpLogger.warn(
                {
                    method,
                    url: sanitizeUrlForLog(config.url),
                    status,
                    netCode,
                    attempt,
                },
                "External HTTP request failed"
            );

            if (isTimeout) {
                throw new HttpClientError("The external service timed out.", {
                    code: "TIMEOUT",
                    status,
                });
            }
            if (status === 429) {
                throw new HttpClientError("External service rate limit reached. Try again shortly.", {
                    code: "RATE_LIMITED",
                    status: 429,
                });
            }
            if (status === 404) {
                throw new HttpClientError("Requested resource was not found.", {
                    code: "NOT_FOUND",
                    status: 404,
                });
            }
            if (status && status >= 400 && status < 500) {
                throw new HttpClientError("External service rejected the request.", {
                    code: "BAD_REQUEST",
                    status,
                });
            }
            if (!status && netCode) {
                throw new HttpClientError("Network error while contacting external service.", {
                    code: "NETWORK_ERROR",
                });
            }

            throw new HttpClientError("External service is currently unavailable.", {
                code: "PROVIDER_ERROR",
                status,
            });
        }
    }
}

module.exports = {
    HttpClientError,
    sanitizeUrlForLog,
    request,
};
