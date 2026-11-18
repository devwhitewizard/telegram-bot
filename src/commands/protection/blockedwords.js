const blockedWordRepository = require("../../database/repositories/blockedWordRepository");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "blockedwords",
    description: "List all blocked words in this group",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const records = await blockedWordRepository.listBlockedWords(ctx.state.group.id);
        if (records.length === 0) {
            await ctx.reply("No blocked words are configured for this group.");
            return;
        }

        const list = records.map((r, i) => `${i + 1}. <code>${escapeHtml(r.word)}</code>`);
        await ctx.reply(
            `<b>Blocked Words (${records.length})</b>\n\n${list.join("\n")}`,
            { parse_mode: "HTML" }
        );
    },
};

