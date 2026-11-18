/**
 * Safely convert a Telegram ID (number, numeric string, or bigint) to BigInt.
 * Telegram chat/user IDs can exceed 32-bit signed integer limits.
 *
 * @param {number | string | bigint} value
 * @param {string} [fieldName="telegramId"]
 * @returns {bigint}
 */
function toBigIntId(value, fieldName = "telegramId") {
    if (typeof value === "bigint") {
        return value;
    }

    if (typeof value === "number") {
        if (!Number.isSafeInteger(value)) {
            throw new TypeError(`${fieldName} must be a safe integer, string, or BigInt`);
        }
        return BigInt(value);
    }

    if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
        return BigInt(value.trim());
    }

    throw new TypeError(`Invalid ${fieldName}: expected integer, numeric string, or BigInt`);
}

/**
 * Validate a positive internal database integer ID.
 *
 * @param {number | string} value
 * @param {string} [fieldName="id"]
 * @returns {number}
 */
function toPositiveInt(value, fieldName = "id") {
    const num = typeof value === "string" ? Number.parseInt(value, 10) : value;
    if (!Number.isInteger(num) || num <= 0) {
        throw new TypeError(`Invalid ${fieldName}: expected a positive integer`);
    }
    return num;
}

module.exports = {
    toBigIntId,
    toPositiveInt,
};

