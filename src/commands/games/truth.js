const truthQuestions = require("../../data/truthQuestions");

module.exports = {
    name: "truth",
    description: "Get a safe, fun Truth prompt",
    execute: async (ctx) => {
        const prompt = truthQuestions[Math.floor(Math.random() * truthQuestions.length)];
        await ctx.reply(`🗣️ <b>Truth:</b> ${prompt}`, { parse_mode: "HTML" });
    },
};

