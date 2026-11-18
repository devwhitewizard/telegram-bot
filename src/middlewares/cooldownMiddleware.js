const botConfig = require("../config/botConfig");

/**
 * Create a per-user, per-chat command cooldown middleware.
 *
 * @param {number} [seconds=botConfig.defaults.commandCooldownSeconds]
 * @returns {(ctx: import("telegraf").Context, next: () => Promise<void>) => Promise<void>}
 */
function createCooldownMiddleware(
    seconds = botConfig.defaults.commandCooldownSeconds,
    { singleFlight = false } = {}
) {
    const cooldownMs = Math.max(0, seconds) * 1000;
    const timestamps = new Map();
    const inFlight = new Set();

    return async function cooldownMiddleware(ctx, next) {
        if (!ctx.from || !ctx.chat) {
            return next();
        }

        const commandKey = (ctx.message?.text || "action").split(/\s+/)[0].toLowerCase();
        const key = `${ctx.chat.id}:${ctx.from.id}:${commandKey}`;

        if (singleFlight && inFlight.has(key)) {
            await ctx.reply("Your previous request is still being processed. Please wait.");
            return;
        }

        const now = Date.now();
        const expiresAt = timestamps.get(key);

        if (cooldownMs > 0 && expiresAt && now < expiresAt) {
            const remainingSeconds = Math.ceil((expiresAt - now) / 1000);
            if (ctx.callbackQuery?.id) {
                await ctx.answerCbQuery(
                    `Please wait ${remainingSeconds}s before trying again.`
                );
            } else {
                await ctx.reply(
                    `Please wait ${remainingSeconds}s before using this command again.`
                );
            }
            return;
        }

        if (cooldownMs > 0) {
            timestamps.set(key, now + cooldownMs);

            // Periodic pruning to prevent unbounded memory growth
            if (timestamps.size > 5000) {
                for (const [entryKey, exp] of timestamps.entries()) {
                    if (exp <= now) {
                        timestamps.delete(entryKey);
                    }
                }
            }
        }

        if (!singleFlight) {
            return next();
        }

        inFlight.add(key);
        try {
            return await next();
        } finally {
            inFlight.delete(key);
        }
    };
}

module.exports = {
    createCooldownMiddleware,
};

