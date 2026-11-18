const captchaRepository = require("../database/repositories/captchaRepository");

const GROUP_CHAT_TYPES = new Set(["group", "supergroup"]);

/**
 * CAPTCHA gate middleware: if a user has a pending unverified CAPTCHA in this group,
 * delete any message they attempt to send until they complete verification.
 */
async function captchaMiddleware(ctx, next) {
    if (!ctx.chat || !GROUP_CHAT_TYPES.has(ctx.chat.type)) {
        return next();
    }
    if (!ctx.message || !ctx.from || ctx.from.is_bot) {
        return next();
    }
    // Never block new_chat_members system events here
    if (ctx.message.new_chat_members) {
        return next();
    }

    const group = ctx.state.group;
    const user = ctx.state.user;
    const settings = ctx.state.groupSettings;

    if (!group || !user || !settings?.captchaEnabled) {
        return next();
    }

    const pending = await captchaRepository.findPendingCaptcha(group.id, user.id);
    if (pending) {
        try {
            await ctx.deleteMessage();
        } catch {
            // Ignore if bot lacks delete permission
        }
        return;
    }

    return next();
}

module.exports = captchaMiddleware;

