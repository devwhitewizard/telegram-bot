const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "groupinfo",
    description: "Display group metadata and active configuration summary",
    groupOnly: true,
    execute: async (ctx) => {
        const group = ctx.state.group;
        const s = ctx.state.groupSettings;
        let memberCount = "?";
        try {
            memberCount = await ctx.telegram.getChatMembersCount(ctx.chat.id);
        } catch {
            memberCount = "?";
        }

        await ctx.reply(
            `ℹ️ <b>Group Information</b>\n\n` +
                `• Title: <b>${escapeHtml(group.title)}</b>\n` +
                `• Chat ID: <code>${group.telegramId}</code>\n` +
                `• Type: ${escapeHtml(group.type)}\n` +
                `• Members: <b>${memberCount}</b>\n` +
                `• Max Warnings: <b>${s.maxWarnings}</b> (${s.warnAction})\n` +
                `• Games: ${s.gamesEnabled ? "Enabled" : "Disabled"} | Fun: ${
                    s.funEnabled ? "Enabled" : "Disabled"
                }`,
            { parse_mode: "HTML" }
        );
    },
};

