const { env } = require("../../config/env");
const { getHealthStatus } = require("../../services/healthService");
const { formatDuration } = require("../../utils/formatDuration");

module.exports = {
    name: "health",
    description: "Show bot uptime, database status, and monitoring metrics",
    cooldown: 5,
    execute: async (ctx) => {
        const userId = String(ctx.from?.id || "");
        const isOwner = env.botOwnerIds.includes(userId);

        if (ctx.chat?.type === "private") {
            if (env.botOwnerIds.length > 0 && !isOwner) {
                await ctx.reply("This command is restricted to bot owners.");
                return;
            }
        } else if (!isOwner) {
            try {
                const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
                if (!member || (member.status !== "creator" && member.status !== "administrator")) {
                    await ctx.reply("Only group administrators or bot owners can view /health.");
                    return;
                }
            } catch {
                await ctx.reply("Could not verify permissions.");
                return;
            }
        }

        const report = await getHealthStatus();
        const jobLines = Object.entries(report.jobs).map(
            ([name, j]) => `• ${name}: <b>${j.status}</b>`
        );

        await ctx.reply(
            `🩺 <b>Bot Health: ${report.status.toUpperCase()}</b>\n\n` +
                `• Uptime: <b>${formatDuration(report.uptimeSeconds)}</b>\n` +
                `• Database: <b>${report.database.status.toUpperCase()}</b> (${report.database.latencyMs}ms)\n` +
                `• Memory: <b>${report.memory.rssMb} MB RSS</b> (${report.memory.heapUsedMb} MB heap)\n` +
                `• Commands Run: <b>${report.metrics.commandsExecutedTotal}</b>\n` +
                `• Errors: <b>${report.metrics.errorsTotal}</b> (TG API: ${report.metrics.telegramApiErrorsTotal}, DB: ${report.metrics.databaseErrorsTotal}, Jobs: ${report.metrics.jobFailuresTotal})` +
                (jobLines.length > 0 ? `\n\n<b>Background Jobs:</b>\n${jobLines.join("\n")}` : ""),
            { parse_mode: "HTML" }
        );
    },
};

