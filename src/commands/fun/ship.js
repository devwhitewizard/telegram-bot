const { getCommandArgs } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "ship",
    description: "Calculate a fun compatibility percentage between two names or users",
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const replyUser = ctx.message?.reply_to_message?.from;

        let first = ctx.from?.first_name || "You";
        let second = replyUser?.first_name || null;

        if (!second && args.length >= 2) {
            first = args[0];
            second = args.slice(1).join(" ");
        } else if (!second && args.length === 1) {
            second = args[0];
        }

        if (!second || second.length > 60) {
            await ctx.reply("Usage: reply to someone with /ship, or /ship <name1> <name2>");
            return;
        }

        const score = Math.floor(Math.random() * 101);
        const barFilled = Math.round(score / 10);
        const bar = "❤️".repeat(Math.max(1, Math.floor(barFilled / 2))) + "🤍".repeat(Math.max(0, 5 - Math.floor(barFilled / 2)));

        await ctx.reply(
            `💘 <b>Ship Meter</b>\n${escapeHtml(first)} + ${escapeHtml(
                second
            )} = <b>${score}%</b>\n${bar}`,
            { parse_mode: "HTML" }
        );
    },
};

