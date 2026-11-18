/**
 * Restrict a command or handler to private (1-on-1) chats with the bot.
 * Stops middleware execution if invoked inside a group or channel.
 *
 * @param {import("telegraf").Context} ctx
 * @param {() => Promise<void>} next
 */
async function privateChatMiddleware(ctx, next) {
    if (!ctx.chat || ctx.chat.type !== "private") {
        await ctx.reply("This command can only be used in a private chat with me.");
        return;
    }

    return next();
}

module.exports = privateChatMiddleware;

