const antiSpamService = require("../services/antiSpamService");
const { applyProtectionAction, shouldInspectGroupMessage } = require("./moderationMiddleware");

/**
 * Anti-spam middleware: detects repeated identical/normalized messages within a configurable window.
 */
async function antiSpamMiddleware(ctx, next) {
    const settings = ctx.state.groupSettings;
    if (!settings?.antiSpamEnabled) {
        return next();
    }

    const inspect =
        ctx.state.shouldProtect !== undefined
            ? ctx.state.shouldProtect
            : await shouldInspectGroupMessage(ctx);

    if (!inspect) {
        return next();
    }

    const text = ctx.message?.text || ctx.message?.caption || "";
    if (!text) {
        return next();
    }

    const result = antiSpamService.checkSpam({
        chatId: ctx.chat.id,
        userId: ctx.from.id,
        text,
        threshold: settings.antiSpamThreshold || 3,
        windowSeconds: settings.antiSpamWindowSeconds || 30,
    });

    if (result.isSpam) {
        await applyProtectionAction(ctx, "WARN", "Repeated spam messages");
        return;
    }

    return next();
}

module.exports = antiSpamMiddleware;

