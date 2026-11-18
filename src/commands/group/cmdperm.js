const settingsService = require("../../services/settingsService");
const { getCommandArgs } = require("../../utils/extractUser");

const PROTECTED_COMMANDS = new Set(["settings", "cmdperm", "help", "start"]);

module.exports = {
    name: "cmdperm",
    description: "Configure per-command permissions (/cmdperm <command> <everyone|admin|disabled>)",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const targetCmd = (args[0] || "").trim().toLowerCase().replace(/^\//, "");
        const level = (args[1] || "").trim().toLowerCase();

        if (!targetCmd || !level) {
            await ctx.reply("Usage: /cmdperm <command> <everyone|admin|disabled>");
            return;
        }

        if (PROTECTED_COMMANDS.has(targetCmd)) {
            await ctx.reply(`/${targetCmd} cannot be restricted or disabled.`);
            return;
        }

        if (ctx.commands && !ctx.commands.has(targetCmd)) {
            await ctx.reply(`Unknown command: /${targetCmd}`);
            return;
        }

        try {
            await settingsService.setCommandPermission(
                ctx.state.group.id,
                ctx.state.groupSettings,
                targetCmd,
                level
            );
            await ctx.reply(`✅ Permission for /${targetCmd} set to "${level}".`);
        } catch (err) {
            await ctx.reply(err.message);
        }
    },
};

