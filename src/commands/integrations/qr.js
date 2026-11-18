const qrService = require("../../services/qrService");
const { getCommandArgs } = require("../../utils/extractUser");

module.exports = {
    name: "qr",
    description: "Generate a QR code image locally (/qr <text or URL>)",
    cooldown: 5,
    execute: async (ctx) => {
        const input = getCommandArgs(ctx).join(" ").trim();
        if (!input) {
            await ctx.reply("Usage: /qr <text or URL>");
            return;
        }

        try {
            const pngBuffer = await qrService.generateQrPng(input);
            await ctx.replyWithPhoto(
                { source: pngBuffer, filename: "qrcode.png" },
                { caption: "Here is your QR code." }
            );
        } catch (err) {
            await ctx.reply(err.message || "Could not generate QR code.");
        }
    },
};
