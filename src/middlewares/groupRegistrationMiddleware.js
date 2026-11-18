const groupRepository = require("../database/repositories/groupRepository");
const { createChildLogger } = require("../utils/logger");

const mwLogger = createChildLogger("groupRegistrationMiddleware");
const GROUP_CHAT_TYPES = new Set(["group", "supergroup"]);

/**
 * Automatically register groups/supergroups and initialize default GroupSettings.
 * Attaches `ctx.state.group` and `ctx.state.groupSettings`.
 * Always calls `next()` so unrelated private chats or transient DB errors do not block updates.
 *
 * @param {import("telegraf").Context} ctx
 * @param {() => Promise<void>} next
 */
async function groupRegistrationMiddleware(ctx, next) {
    if (ctx.chat && GROUP_CHAT_TYPES.has(ctx.chat.type)) {
        try {
            const dbGroup = await groupRepository.registerGroup({
                telegramId: ctx.chat.id,
                title: ctx.chat.title || "Untitled Group",
                username: ctx.chat.username || null,
                type: ctx.chat.type,
            });
            ctx.state.group = dbGroup;
            ctx.state.groupSettings = dbGroup.settings;
        } catch (err) {
            mwLogger.error(
                { err, chatId: ctx.chat.id },
                "Failed to register/update group"
            );
        }
    }

    return next();
}

module.exports = groupRegistrationMiddleware;

