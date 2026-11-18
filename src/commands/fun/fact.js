const { facts } = require("../../data/entertainmentData");

module.exports = {
    name: "fact",
    description: "Share an interesting random fact",
    execute: async (ctx) => {
        const fact = facts[Math.floor(Math.random() * facts.length)];
        await ctx.reply(`💡 <b>Did you know?</b>\n${fact}`, { parse_mode: "HTML" });
    },
};

