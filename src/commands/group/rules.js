const { escapeHtml } = require("../../utils/escapeMarkdown");

const DEFAULT_RULES =
    "1. Respect everyone.\n2. No spam or flooding.\n3. No unauthorized advertising or links.\n4. Follow administrator instructions.";

module.exports = {
    name: "rules",
    description: "Display the group rules",
    groupOnly: true,
    execute: async (ctx) => {
        const rules = ctx.state.groupSettings?.rules || DEFAULT_RULES;
        const title = escapeHtml(ctx.chat?.title || "Group");
        await ctx.reply(`📜 <b>${title} Rules</b>\n\n${escapeHtml(rules)}`, {
            parse_mode: "HTML",
        });
    },
};

