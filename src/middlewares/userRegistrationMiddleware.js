const userRepository = require("../database/repositories/userRepository");
const { createChildLogger } = require("../utils/logger");

const mwLogger = createChildLogger("userRegistrationMiddleware");

/**
 * Automatically register or update Telegram users who interact with the bot.
 * Attaches the persisted database user to `ctx.state.user`.
 * Always calls `next()` so a transient DB error never blocks bot commands.
 *
 * @param {import("telegraf").Context} ctx
 * @param {() => Promise<void>} next
 */
async function userRegistrationMiddleware(ctx, next) {
    if (ctx.from && !ctx.from.is_bot) {
        try {
            const dbUser = await userRepository.upsertUser({
                telegramId: ctx.from.id,
                username: ctx.from.username || null,
                firstName: ctx.from.first_name || "User",
                lastName: ctx.from.last_name || null,
            });
            ctx.state.user = dbUser;
        } catch (err) {
            mwLogger.error(
                { err, telegramId: ctx.from.id },
                "Failed to register/update user"
            );
        }
    }

    return next();
}

module.exports = userRegistrationMiddleware;

