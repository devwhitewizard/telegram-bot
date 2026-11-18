const { createChildLogger } = require("../utils/logger");

const mwLogger = createChildLogger("adminMiddleware");
const GROUP_CHAT_TYPES = new Set(["group", "supergroup"]);
const ADMIN_STATUSES = new Set(["creator", "administrator"]);
// Telegram's built-in anonymous group admin sender ID
const ANONYMOUS_ADMIN_BOT_ID = 1087968824;

/**
 * Verify that the user issuing a protected command is a group administrator or owner.
 * Uses Telegram's `getChatMember` API.
 *
 * @param {import("telegraf").Context} ctx
 * @param {() => Promise<void>} next
 */
async function adminMiddleware(ctx, next) {
    if (!ctx.chat || !GROUP_CHAT_TYPES.has(ctx.chat.type)) {
        await ctx.reply("Administrator commands can only be used in groups.");
        return;
    }

    if (!ctx.from) {
        return;
    }

    // Anonymous admins post as GroupAnonymousBot (id 1087968824) on behalf of the chat
    if (ctx.from.id === ANONYMOUS_ADMIN_BOT_ID && ctx.message?.sender_chat?.id === ctx.chat.id) {
        ctx.state.isAnonymousAdmin = true;
        return next();
    }

    try {
        const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
        if (!member || !ADMIN_STATUSES.has(member.status)) {
            await ctx.reply("You must be a group administrator to use this command.");
            return;
        }

        ctx.state.member = member;
        return next();
    } catch (err) {
        mwLogger.error(
            { err, chatId: ctx.chat.id, userId: ctx.from.id },
            "Failed to verify administrator status via getChatMember"
        );
        await ctx.reply("Could not verify your administrator permissions right now.");
    }
}

module.exports = adminMiddleware;

