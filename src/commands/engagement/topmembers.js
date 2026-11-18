const { Markup } = require("telegraf");
const activityService = require("../../services/activityService");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "topmembers",
    description: "Show the most active members in this group",
    groupOnly: true,
    execute: async (ctx) => {
        const { rows, totalPages } = await activityService.getTopMembers(ctx.state.group.id, {
            page: 1,
            pageSize: 10,
        });

        if (rows.length === 0) {
            await ctx.reply("No member activity recorded yet.");
            return;
        }

        const lines = rows.map((row, idx) => {
            const name = escapeHtml(row.user?.firstName || "User");
            return `${idx + 1}. <b>${name}</b> — ${row.messageCount} msgs`;
        });

        const buttons = [];
        if (totalPages > 1) {
            buttons.push(Markup.button.callback("Next ➡️", "topmembers:2"));
        }

        await ctx.reply(
            `📊 <b>Top Active Members</b> (Page 1/${totalPages})\n\n${lines.join("\n")}`,
            {
                parse_mode: "HTML",
                ...(buttons.length > 0 ? Markup.inlineKeyboard([buttons]) : {}),
            }
        );
    },
};

