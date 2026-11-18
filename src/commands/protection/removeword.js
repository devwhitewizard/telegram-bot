const blockedWordRepository = require("../../database/repositories/blockedWordRepository");
const { getCommandArgs } = require("../../utils/extractUser");

module.exports = {
    name: "removeword",
    description: "Remove a word from the group's blocked words list",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const word = args.join(" ").trim();
        if (!word) {
            await ctx.reply("Usage: /removeword <word_or_phrase>");
            return;
        }

        const res = await blockedWordRepository.removeBlockedWord(ctx.state.group.id, word);
        if (res.count === 0) {
            await ctx.reply(`"${word.toLowerCase()}" was not in the blocked words list.`);
            return;
        }
        await ctx.reply(`✅ Removed "${word.toLowerCase()}" from blocked words.`);
    },
};

