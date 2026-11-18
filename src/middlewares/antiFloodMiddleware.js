const antiSpamService = require("../services/antiSpamService");
const { applyProtectionAction, shouldInspectGroupMessage } = require("./moderationMiddleware");

/**
 * Anti-flood middleware: detects excessive messages sent within a short time window.
 */
async function antiFloodMiddleware(ctx, next) {
    const settings = ctx.state.groupSettings;
    if (!settings?.antiFloodEnabled) {
        return next();
    }

    const inspect =
        ctx.state.shouldProtect !== undefined
            ? ctx.state.shouldProtect
            : await shouldInspectGroupMessage(ctx);

    if (!inspect) {
        return next();
    }

    const result = antiSpamService.checkFlood({
        chatId: ctx.chat.id,
        userId: ctx.from.id,
        maxMessages: settings.antiFloodMaxMessages || 5,
        windowSeconds: settings.antiFloodWindowSeconds || 5,
    });

    if (result.isFlood) {
        await applyProtectionAction(
            ctx,
            settings.antiFloodAction || "MUTE",
            "Message flooding"
        );
        return;
    }

    return next();
}

module.exports = antiFloodMiddleware;

