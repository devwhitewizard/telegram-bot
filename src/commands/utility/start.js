const botConfig = require("../../config/botConfig");

module.exports = {
    name: "start",
    description: "Start the bot and view welcome info",
    cooldown: 2,
    execute: async (ctx) => {
        const firstName = ctx.from?.first_name || "there";
        await ctx.reply(
            `Hello, ${firstName}! I am ${botConfig.name}.\nUse /help to see available commands.`
        );
    },
};

