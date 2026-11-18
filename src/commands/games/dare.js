const dareQuestions = require("../../data/dareQuestions");

module.exports = {
    name: "dare",
    description: "Get a safe, fun Dare prompt",
    execute: async (ctx) => {
        const prompt = dareQuestions[Math.floor(Math.random() * dareQuestions.length)];
        await ctx.reply(`🔥 <b>Dare:</b> ${prompt}`, { parse_mode: "HTML" });
    },
};

