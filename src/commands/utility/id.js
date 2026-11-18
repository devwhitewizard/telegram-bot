const { extractTargetUser } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "id",
    description: "Show your Telegram ID, chat ID, or a replied user's ID",
    execute: async (ctx) => {
        const { target } = await extractTargetUser(ctx);
        const subject = target || ctx.from;
        const lines = [
            `👤 <b>${escapeHtml(subject.first_name || "User")}</b> ID: <code>${subject.id}</code>`,
        ];

        if (ctx.chat) {
            lines.push(`💬 Chat ID: <code>${ctx.chat.id}</code> (${escapeHtml(ctx.chat.type)})`);
        }

        await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    },
};

