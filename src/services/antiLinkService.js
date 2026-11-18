const URL_REGEX = /(?:https?:\/\/|www\.|t\.me\/)[^\s<>"{}|\\^`[\]]+/gi;

/**
 * Safely parse the JSON-encoded allowedDomains string from GroupSettings.
 * @param {string | string[] | null | undefined} raw
 * @returns {string[]}
 */
function parseAllowedDomains(raw) {
    if (Array.isArray(raw)) {
        return raw.map((d) => String(d).trim().toLowerCase()).filter(Boolean);
    }
    if (!raw || typeof raw !== "string") {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.map((d) => String(d).trim().toLowerCase()).filter(Boolean);
    } catch {
        return [];
    }
}

/**
 * Extract a normalized lowercase hostname from a URL string.
 * @param {string} rawUrl
 * @returns {string | null}
 */
function extractHostname(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") {
        return null;
    }
    const candidate = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    try {
        const url = new URL(candidate);
        return url.hostname.toLowerCase().replace(/^www\./, "");
    } catch {
        return null;
    }
}

/**
 * Extract all URLs from a Telegram message using both Telegram entities
 * (url, text_link) and a fallback regex for unparsed links.
 *
 * @param {object} message - Telegram Message object
 * @returns {string[]}
 */
function extractUrlsFromMessage(message) {
    if (!message) {
        return [];
    }

    const urls = new Set();
    const text = message.text || message.caption || "";
    const entities = [
        ...(Array.isArray(message.entities) ? message.entities : []),
        ...(Array.isArray(message.caption_entities) ? message.caption_entities : []),
    ];

    for (const entity of entities) {
        if (entity.type === "text_link" && entity.url) {
            urls.add(entity.url);
        } else if (entity.type === "url" && text) {
            const slice = text.slice(entity.offset, entity.offset + entity.length);
            if (slice) {
                urls.add(slice);
            }
        }
    }

    if (text) {
        const matches = text.match(URL_REGEX) || [];
        for (const match of matches) {
            urls.add(match);
        }
    }

    return Array.from(urls);
}

/**
 * Check if a hostname is allowed by the group's whitelist.
 * Supports exact matches and subdomains (e.g. "youtube.com" allows "m.youtube.com").
 *
 * @param {string} hostname
 * @param {string[]} allowedDomains
 * @returns {boolean}
 */
function isDomainAllowed(hostname, allowedDomains) {
    const cleanHost = hostname.toLowerCase().replace(/^www\./, "");
    return allowedDomains.some((allowed) => {
        const cleanAllowed = allowed.toLowerCase().replace(/^www\./, "");
        return cleanHost === cleanAllowed || cleanHost.endsWith(`.${cleanAllowed}`);
    });
}

/**
 * Inspect a Telegram message for prohibited external links.
 *
 * @param {object} message
 * @param {string | string[]} allowedDomainsRaw
 * @returns {{ hasProhibitedLink: boolean, detectedUrls: string[], blockedDomains: string[] }}
 */
function checkMessageLinks(message, allowedDomainsRaw) {
    const urls = extractUrlsFromMessage(message);
    if (urls.length === 0) {
        return { hasProhibitedLink: false, detectedUrls: [], blockedDomains: [] };
    }

    const allowedDomains = parseAllowedDomains(allowedDomainsRaw);
    const blockedDomains = [];

    for (const rawUrl of urls) {
        const host = extractHostname(rawUrl);
        if (!host) {
            continue;
        }
        if (!isDomainAllowed(host, allowedDomains)) {
            blockedDomains.push(host);
        }
    }

    return {
        hasProhibitedLink: blockedDomains.length > 0,
        detectedUrls: urls,
        blockedDomains: Array.from(new Set(blockedDomains)),
    };
}

module.exports = {
    parseAllowedDomains,
    extractHostname,
    extractUrlsFromMessage,
    isDomainAllowed,
    checkMessageLinks,
};

