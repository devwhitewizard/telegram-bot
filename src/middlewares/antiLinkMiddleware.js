const antiLinkService = require("../services/antiLinkService");
const { applyProtectionAction, shouldInspectGroupMessage } = require("./moderationMiddleware");

/**
 * Anti-link middleware: blocks unauthorized external links using Telegram entities and URL extraction.
 */
async function antiLinkMiddleware(ctx, next) {
    const settings = ctx.state.groupSettings;
    if (!settings?.antiLinkEnabled) {
        return next();
    }

    const inspect =
        ctx.state.shouldProtect !== undefined
            ? ctx.state.shouldProtect
            : await shouldInspectGroupMessage(ctx);

    if (!inspect) {
        return next();
    }

    const result = antiLinkService.checkMessageLinks(
        ctx.message,
        settings.allowedDomains
    );

    if (result.hasProhibitedLink) {
        await applyProtectionAction(
            ctx,
            settings.antiLinkAction || "DELETE",
            `Prohibited link (${result.blockedDomains.join(", ")})`
        );
        return;
    }

    return next();
}

module.exports = antiLinkMiddleware;

