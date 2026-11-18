const { getCommandArgs } = require("../../utils/extractUser");

module.exports = {
    name: "roll",
    description: "Roll a die (default 6 sides, or /roll <sides>)",
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        let sides = 6;

        if (args[0] !== undefined) {
            const parsed = Number.parseInt(args[0], 10);
            if (!Number.isInteger(parsed) || parsed < 2 || parsed > 1000) {
                await ctx.reply("Please provide a valid number of sides between 2 and 1000.");
                return;
            }
            sides = parsed;
        }

        const result = Math.floor(Math.random() * sides) + 1;
        await ctx.reply(`🎲 You rolled a <b>${result}</b> (1–${sides})!`, {
            parse_mode: "HTML",
        });
    },
};

