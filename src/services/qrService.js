const QRCode = require("qrcode");

const MAX_QR_LENGTH = 1000;

/**
 * Generate a QR code PNG buffer locally without external API calls.
 * @param {string} text
 * @returns {Promise<Buffer>}
 */
async function generateQrPng(text) {
    const clean = String(text || "").trim();
    if (!clean) {
        throw new TypeError("Please provide text or a URL to encode. Usage: /qr <text>");
    }
    if (clean.length > MAX_QR_LENGTH) {
        throw new TypeError(`QR input is too long (maximum ${MAX_QR_LENGTH} characters).`);
    }

    return QRCode.toBuffer(clean, {
        type: "png",
        width: 320,
        margin: 2,
        errorCorrectionLevel: "M",
    });
}

module.exports = {
    MAX_QR_LENGTH,
    generateQrPng,
};
