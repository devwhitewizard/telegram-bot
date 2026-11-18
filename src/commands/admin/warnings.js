const warningService = require("../../services/warningService");
const { extractTargetUser } = require("../../utils/extractUser");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "warnings",
    description: "Display warning history for a user (or yourself)",
    groupOnly: true,
    execute: async (ctx) => {
        const { target } = await extractTargetUser(ctx);
        const targetUser = target || ctx.from;

        const { warnings } = await warningService.getUserWarnings(
            ctx.state.group.id,
            targetUser
        );

        const name = escapeHtml(targetUser.first_name || `User ${targetUser.id}`);
        const maxWarnings = ctx.state.groupSettings?.maxWarnings || 3;

        if (warnings.length === 0) {
            await ctx.reply(`<b>${name}</b> has no active warnings (0/${maxWarnings}).`, {
                parse_mode: "HTML",
            });
            return;
        }

        const lines = warnings.map((w, idx) => {
            const date = w.createdAt.toISOString().slice(0, 10);
            const reason = w.reason ? escapeHtml(w.reason) : "No reason specified";
            const issuer = escapeHtml(w.issuer?.firstName || "Admin");
            return `${idx + 1}. [${date}] ${reason} (by ${issuer})`;
        });

        await ctx.reply(
            `⚠️ Warnings for <b>${name}</b> (${warnings.length}/${maxWarnings}):\n\n${lines.join(
                "\n"
            )}`,
            { parse_mode: "HTML" }
        );
    },
};

