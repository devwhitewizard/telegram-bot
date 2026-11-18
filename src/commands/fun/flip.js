module.exports = {
    name: "flip",
    description: "Flip a coin (Heads or Tails)",
    execute: async (ctx) => {
        const result = Math.random() < 0.5 ? "Heads" : "Tails";
        await ctx.reply(`🪙 The coin landed on <b>${result}</b>!`, {
            parse_mode: "HTML",
        });
    },
};

