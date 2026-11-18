const { roasts } = require("../../data/entertainmentData");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "roast",
    description: "Send a lighthearted, harmless roast (reply to someone)",
    execute: async (ctx) => {
        const target = ctx.message?.reply_to_message?.from || ctx.from;
        const msg = roasts[Math.floor(Math.random() * roasts.length)];
        const name = escapeHtml(target?.first_name || "Friend");

        await ctx.reply(`🔥 <b>${name}</b>: ${msg}`, { parse_mode: "HTML" });
    },
};

