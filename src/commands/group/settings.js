const { buildSettingsView } = require("../../keyboards/settingsKeyboard");

module.exports = {
    name: "settings",
    description: "Open interactive group settings menu (Admin only)",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const view = buildSettingsView("main", ctx.state.groupSettings, ctx.chat?.title || "Group");
        await ctx.reply(view.text, view.extra);
    },
};

