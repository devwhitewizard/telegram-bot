const net = require("net");
const { request } = require("./httpClient");

/**
 * Check if a hostname or IP points to localhost or private/internal network ranges.
 */
function isPrivateOrInternalHost(hostname) {
    const host = String(hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
    if (!host) return true;
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
        return true;
    }

    const ipVersion = net.isIP(host);
    if (ipVersion === 4) {
        const parts = host.split(".").map((n) => Number.parseInt(n, 10));
        if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
        if (parts[0] === 169 && parts[1] === 254) return true;
        if (parts[0] === 192 && parts[1] === 168) return true;
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    } else if (ipVersion === 6) {
        if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
            return true;
        }
    }

    return false;
}

/**
 * Validate that a URL uses http: or https:, has no embedded credentials,
 * and does not target internal/private hosts.
 */
function validatePublicHttpUrl(rawUrl) {
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed || trimmed.length > 2048) {
        throw new TypeError("Please provide a valid URL (max 2048 characters).");
    }

    let parsed;
    try {
        parsed = new URL(trimmed);
    } catch {
        throw new TypeError("Invalid URL format. Include http:// or https://.");
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new TypeError("Only http:// and https:// URLs are allowed.");
    }

    if (parsed.username || parsed.password) {
        throw new TypeError("URLs containing credentials are not allowed.");
    }

    if (isPrivateOrInternalHost(parsed.hostname)) {
        throw new TypeError("Internal or private network URLs cannot be shortened.");
    }

    return parsed.toString();
}

/**
 * Shorten a validated public HTTP/HTTPS URL using keyless is.gd API.
 */
async function shortenUrl(rawUrl) {
    const safeUrl = validatePublicHttpUrl(rawUrl);

    const data = await request({
        method: "GET",
        url: "https://is.gd/create.php",
        params: {
            format: "json",
            url: safeUrl,
        },
    });

    if (data?.errorcode || !data?.shorturl) {
        throw new Error(data?.errormessage || "Failed to shorten URL.");
    }

    return {
        originalUrl: safeUrl,
        shortUrl: data.shorturl,
    };
}

module.exports = {
    isPrivateOrInternalHost,
    validatePublicHttpUrl,
    shortenUrl,
};

