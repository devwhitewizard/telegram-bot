const { compliments } = require("../../data/entertainmentData");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "compliment",
    description: "Send a friendly compliment (reply to someone or compliment yourself)",
    execute: async (ctx) => {
        const target = ctx.message?.reply_to_message?.from || ctx.from;
        const msg = compliments[Math.floor(Math.random() * compliments.length)];
        const name = escapeHtml(target?.first_name || "Friend");

        await ctx.reply(`✨ <b>${name}</b>, ${msg}`, { parse_mode: "HTML" });
    },
};

