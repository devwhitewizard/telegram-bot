const { jokes } = require("../../data/entertainmentData");

module.exports = {
    name: "joke",
    description: "Tell a random clean joke",
    execute: async (ctx) => {
        const joke = jokes[Math.floor(Math.random() * jokes.length)];
        await ctx.reply(`😄 ${joke}`);
    },
};

