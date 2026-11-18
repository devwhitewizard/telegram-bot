const moderationService = require("../../services/moderationService");
const { escapeHtml } = require("../../utils/escapeMarkdown");

module.exports = {
    name: "admins",
    description: "List all administrators in this group",
    groupOnly: true,
    execute: async (ctx) => {
        const admins = await moderationService.getGroupAdmins(ctx);
        if (!admins || admins.length === 0) {
            await ctx.reply("No administrators found.");
            return;
        }

        const lines = admins.map((admin) => {
            const role = admin.status === "creator" ? "👑 Owner" : "🛡️ Admin";
            const name = escapeHtml(admin.user.first_name || "Admin");
            const username = admin.user.username ? ` (@${escapeHtml(admin.user.username)})` : "";
            return `${role}: <b>${name}</b>${username}`;
        });

        await ctx.reply(`<b>Group Administrators</b>\n\n${lines.join("\n")}`, {
            parse_mode: "HTML",
        });
    },
};

