const blockedWordRepository = require("../../database/repositories/blockedWordRepository");
const { getCommandArgs } = require("../../utils/extractUser");

module.exports = {
    name: "addword",
    description: "Add a word to the group's blocked words list",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const word = args.join(" ").trim();
        if (!word) {
            await ctx.reply("Usage: /addword <word_or_phrase>");
            return;
        }

        const record = await blockedWordRepository.addBlockedWord(ctx.state.group.id, word);
        await ctx.reply(`✅ Added "${record.word}" to blocked words.`);
    },
};

