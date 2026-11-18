const currencyService = require("../../services/currencyService");
const { getCommandArgs } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "currency",
    description: "Convert currency (/currency <amount> <from> <to>)",
    cooldown: 5,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        if (args.length < 3) {
            await ctx.reply("Usage: /currency <amount> <FROM> <TO>\nExample: /currency 100 USD EUR");
            return;
        }

        try {
            const res = await currencyService.convertCurrency(args[0], args[1], args[2]);
            const dateNote = res.date ? `\nRate date: ${escapeHtml(res.date)}` : "";

            await ctx.reply(
                `💱 <b>${res.amount} ${escapeHtml(res.from)} = ${res.converted} ${escapeHtml(
                    res.to
                )}</b>\nRate: 1 ${escapeHtml(res.from)} = ${res.rate} ${escapeHtml(
                    res.to
                )}${dateNote}`,
                { parse_mode: "HTML" }
            );
        } catch (err) {
            await ctx.reply(err.message || "Could not convert currency right now.");
        }
    },
};

