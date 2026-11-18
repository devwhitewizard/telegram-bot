const { createChildLogger } = require("../../utils/logger");

const cmdLogger = createChildLogger("command:ping");

module.exports = {
    name: "ping",
    description: "Check bot responsiveness",
    cooldown: 2,
    execute: async (ctx) => {
        const start = Date.now();
        const sent = await ctx.reply("Pong!");
        const latencyMs = Date.now() - start;
        cmdLogger.debug({ chatId: ctx.chat?.id, latencyMs }, "Ping executed");
        return sent;
    },
};

