const blockedWordRepository = require("../database/repositories/blockedWordRepository");
const { applyProtectionAction, shouldInspectGroupMessage } = require("./moderationMiddleware");

/**
 * Escape special regex characters in a blocked word.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check if text contains any blocked word using case-insensitive word-boundary matching.
 * @param {string} text
 * @param {string[]} words
 * @returns {string | null} Matched word or null
 */
function findBlockedWord(text, words) {
    if (!text || !Array.isArray(words) || words.length === 0) {
        return null;
    }

    for (const word of words) {
        const escaped = escapeRegex(word.trim());
        if (!escaped) continue;
        // Match whole word/phrase bounded by non-word chars or start/end of string
        const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}([^\\p{L}\\p{N}_]|$)`, "iu");
        if (pattern.test(text)) {
            return word;
        }
    }

    return null;
}

/**
 * Bad-word filter middleware: checks message text/caption against per-group blocked words.
 */
async function badWordMiddleware(ctx, next) {
    const settings = ctx.state.groupSettings;
    const group = ctx.state.group;
    if (!settings?.badWordFilterEnabled || !group) {
        return next();
    }

    const inspect =
        ctx.state.shouldProtect !== undefined
            ? ctx.state.shouldProtect
            : await shouldInspectGroupMessage(ctx);

    if (!inspect) {
        return next();
    }

    const text = ctx.message?.text || ctx.message?.caption || "";
    if (!text) {
        return next();
    }

    const blockedRecords = await blockedWordRepository.listBlockedWords(group.id);
    const words = blockedRecords.map((r) => r.word);
    const matched = findBlockedWord(text, words);

    if (matched) {
        await applyProtectionAction(ctx, "DELETE", "Prohibited language");
        return;
    }

    return next();
}

module.exports = {
    badWordMiddleware,
    findBlockedWord,
};

