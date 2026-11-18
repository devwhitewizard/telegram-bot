const { request, HttpClientError } = require("./httpClient");

const CURRENCY_CODE_REGEX = /^[A-Z]{3}$/;

/**
 * Convert currency using the keyless Frankfurter (ECB) API.
 * @param {number | string} amountInput
 * @param {string} fromInput
 * @param {string} toInput
 */
async function convertCurrency(amountInput, fromInput, toInput) {
    const amount = Number(amountInput);
    const from = String(fromInput || "").trim().toUpperCase();
    const to = String(toInput || "").trim().toUpperCase();

    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
        throw new TypeError("Amount must be a positive number.");
    }
    if (!CURRENCY_CODE_REGEX.test(from) || !CURRENCY_CODE_REGEX.test(to)) {
        throw new TypeError("Currency codes must be 3-letter ISO codes (e.g., USD, EUR, GBP).");
    }

    if (from === to) {
        return {
            amount,
            from,
            to,
            rate: 1,
            converted: amount,
            date: new Date().toISOString().slice(0, 10),
        };
    }

    try {
        const data = await request({
            method: "GET",
            url: "https://api.frankfurter.app/latest",
            params: { amount, from, to },
        });

        const converted = data?.rates?.[to];
        if (typeof converted !== "number") {
            throw new Error(`Currency "${to}" is not available.`);
        }

        const rate = Number((converted / amount).toFixed(6));
        return {
            amount,
            from,
            to,
            rate,
            converted,
            date: data.date || null,
        };
    } catch (err) {
        if (err instanceof HttpClientError && err.code === "NOT_FOUND") {
            throw new Error(`Unsupported currency pair: ${from} -> ${to}.`);
        }
        throw err;
    }
}

module.exports = {
    convertCurrency,
};
