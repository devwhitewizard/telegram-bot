const GROUP_CHAT_TYPES = new Set(["group", "supergroup"]);

/**
 * Restrict a command or handler to group and supergroup chats.
 * Stops middleware execution if invoked in a private chat or channel.
 *
 * @param {import("telegraf").Context} ctx
 * @param {() => Promise<void>} next
 */
async function groupMiddleware(ctx, next) {
    if (!ctx.chat || !GROUP_CHAT_TYPES.has(ctx.chat.type)) {
        await ctx.reply("This command can only be used in groups and supergroups.");
        return;
    }

    return next();
}

module.exports = groupMiddleware;

