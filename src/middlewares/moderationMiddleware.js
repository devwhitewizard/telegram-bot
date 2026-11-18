const protectionService = require("../services/protectionService");
const moderationService = require("../services/moderationService");
const warningService = require("../services/warningService");
const { createChildLogger } = require("../utils/logger");

const mwLogger = createChildLogger("moderationMiddleware");
const GROUP_CHAT_TYPES = new Set(["group", "supergroup"]);

/**
 * Shared guard for group protection middlewares.
 * Skips private chats, channels, bot senders, and exempt users (admins / trusted users).
 */
async function shouldInspectGroupMessage(ctx) {
    if (!ctx.chat || !GROUP_CHAT_TYPES.has(ctx.chat.type)) {
        return false;
    }
    if (!ctx.message || !ctx.from || ctx.from.is_bot) {
        return false;
    }
    // Skip slash commands so admins/users aren't blocked by text filters on commands
    if (ctx.message.text && ctx.message.text.startsWith("/")) {
        return false;
    }

    const group = ctx.state.group;
    const settings = ctx.state.groupSettings;
    if (!group || !settings) {
        return false;
    }

    const exempt = await protectionService.isUserExempt(
        ctx,
        group.id,
        ctx.state.user?.id || null
    );
    return !exempt;
}

/**
 * Apply a configured protection penalty ("DELETE", "WARN", or "MUTE") and delete the offending message.
 */
async function applyProtectionAction(ctx, action, reason) {
    try {
        await ctx.deleteMessage();
    } catch (err) {
        mwLogger.warn(
            { err, chatId: ctx.chat?.id, messageId: ctx.message?.message_id },
            "Could not delete offending message"
        );
    }

    const normalized = String(action || "DELETE").toUpperCase();
    const group = ctx.state.group;
    const settings = ctx.state.groupSettings;
    const botId = ctx.botInfo?.id || (await ctx.telegram.getMe()).id;
    const botDbUser = await moderationService.ensureDbUser({
        id: botId,
        first_name: ctx.botInfo?.first_name || "Bot",
        username: ctx.botInfo?.username || null,
    });

    if (normalized === "MUTE") {
        const durationSeconds = (settings?.warnMuteMinutes || 60) * 60;
        try {
            await moderationService.muteUser({
                ctx,
                group,
                targetTgUser: ctx.from,
                adminDbUser: botDbUser,
                reason,
                durationSeconds,
            });
            await ctx.reply(
                `${ctx.from.first_name} has been muted (${reason}).`
            );
        } catch (err) {
            mwLogger.warn({ err, chatId: ctx.chat?.id }, "Auto-mute failed");
        }
    } else if (normalized === "WARN") {
        try {
            const result = await warningService.warnUser({
                ctx,
                group,
                settings,
                targetTgUser: ctx.from,
                adminDbUser: botDbUser,
                reason,
            });
            let msg = `${ctx.from.first_name} was warned (${result.totalWarnings}/${result.maxWarnings}): ${reason}`;
            if (result.autoAction) {
                msg += `\nAutomatic action applied: ${result.autoAction.action}.`;
            }
            await ctx.reply(msg);
        } catch (err) {
            mwLogger.warn({ err, chatId: ctx.chat?.id }, "Auto-warn failed");
        }
    }
}

/**
 * Telegraf middleware that annotates `ctx.state.shouldProtect` for downstream protection middlewares.
 */
async function moderationMiddleware(ctx, next) {
    ctx.state.shouldProtect = await shouldInspectGroupMessage(ctx);
    return next();
}

module.exports = {
    moderationMiddleware,
    shouldInspectGroupMessage,
    applyProtectionAction,
};

