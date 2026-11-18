const activityService = require("../services/activityService");

const GROUP_CHAT_TYPES = new Set(["group", "supergroup"]);

/**
 * Track group & user message activity efficiently using an in-memory batch buffer.
 * Respects `GroupSettings.activityTrackingEnabled`.
 */
async function activityMiddleware(ctx, next) {
    if (
        ctx.chat &&
        GROUP_CHAT_TYPES.has(ctx.chat.type) &&
        ctx.message &&
        ctx.from &&
        !ctx.from.is_bot &&
        ctx.state.group &&
        ctx.state.user &&
        ctx.state.groupSettings?.activityTrackingEnabled !== false
    ) {
        await activityService.recordMessageActivity(ctx.state.group.id, ctx.state.user.id);
    }

    return next();
}

module.exports = activityMiddleware;

