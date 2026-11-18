const { quotes } = require("../../data/entertainmentData");

module.exports = {
    name: "quote",
    description: "Share an inspiring or insightful quote",
    execute: async (ctx) => {
        const quote = quotes[Math.floor(Math.random() * quotes.length)];
        await ctx.reply(`💬 <i>${quote}</i>`, { parse_mode: "HTML" });
    },
};

