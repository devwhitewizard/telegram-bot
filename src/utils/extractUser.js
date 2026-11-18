const userRepository = require("../database/repositories/userRepository");

/**
 * Parse command arguments after the command trigger (e.g. "/ban 12345 spam" -> ["12345", "spam"]).
 * @param {import("telegraf").Context} ctx
 * @returns {string[]}
 */
function getCommandArgs(ctx) {
    const text = ctx.message?.text || "";
    const parts = text.trim().split(/\s+/);
    return parts.slice(1);
}

/**
 * Resolve the target Telegram user from:
 * 1. `reply_to_message.from`
 * 2. `text_mention` entity
 * 3. Numeric Telegram user ID as the first argument
 *
 * Returns `{ target, args }` where `args` contains the remaining arguments
 * (e.g., duration and/or reason) after consuming any user identifier argument.
 *
 * @param {import("telegraf").Context} ctx
 * @returns {Promise<{ target: { id: number | bigint, first_name?: string, username?: string, last_name?: string, is_bot?: boolean } | null, args: string[] }>}
 */
async function extractTargetUser(ctx) {
    const args = getCommandArgs(ctx);

    // 1. Reply-to-message targeting
    const replyFrom = ctx.message?.reply_to_message?.from;
    if (replyFrom) {
        return {
            target: replyFrom,
            args,
        };
    }

    // 2. Inline text_mention entity (users without @username)
    const entities = ctx.message?.entities || [];
    const textMention = entities.find((e) => e.type === "text_mention" && e.user);
    if (textMention) {
        // Consume the mention token(s) if at the start of args
        return {
            target: textMention.user,
            args: args.slice(1),
        };
    }

    // 3. Explicit numeric Telegram user ID in first argument
    if (args.length > 0 && /^-?\d{5,20}$/.test(args[0])) {
        const numericId = Number(args[0]);
        const dbUser = await userRepository.findUserByTelegramId(args[0]);
        return {
            target: dbUser
                ? {
                      id: Number(dbUser.telegramId),
                      first_name: dbUser.firstName,
                      last_name: dbUser.lastName || undefined,
                      username: dbUser.username || undefined,
                  }
                : {
                      id: Number.isSafeInteger(numericId) ? numericId : args[0],
                      first_name: `User ${args[0]}`,
                  },
            args: args.slice(1),
        };
    }

    return {
        target: null,
        args,
    };
}

module.exports = {
    getCommandArgs,
    extractTargetUser,
};

