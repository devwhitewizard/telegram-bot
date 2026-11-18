module.exports = {
    name: "help",
    description: "Show available commands",
    cooldown: 2,
    execute: async (ctx) => {
        const commandsMap = ctx.commands;
        if (!commandsMap || commandsMap.size === 0) {
            await ctx.reply("No commands are currently registered.");
            return;
        }

        const lines = [];
        for (const cmd of commandsMap.values()) {
            if (!cmd.hidden) {
                lines.push(`/${cmd.name} - ${cmd.description}`);
            }
        }

        await ctx.reply(`Available commands:\n\n${lines.join("\n")}`);
    },
};

