const userRepository = require("../database/repositories/userRepository");

/**
 * Escape text for Telegram HTML parse mode.
 * @param {string | number | null | undefined} value
 * @returns {string}
 */
function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Escape text for Telegram MarkdownV2 parse mode.
 * @param {string | number | null | undefined} value
 * @returns {string}
 */
function escapeMarkdownV2(value) {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

module.exports = {
    escapeHtml,
    escapeMarkdownV2,
};

