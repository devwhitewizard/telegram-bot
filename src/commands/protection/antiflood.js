const settingsRepository = require("../../database/repositories/settingsRepository");
const { getCommandArgs } = require("../../utils/extractUser");

const VALID_ACTIONS = new Set(["DELETE", "WARN", "MUTE"]);

module.exports = {
    name: "antiflood",
    description: "Configure anti-flood protection (on|off|limit <msgs> <sec>|action <delete|warn|mute>)",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const group = ctx.state.group;
        const settings = ctx.state.groupSettings;
        const sub = (args[0] || "").toLowerCase();

        if (sub === "on") {
            await settingsRepository.updateGroupSettings(group.id, { antiFloodEnabled: true });
            await ctx.reply("✅ Anti-flood protection enabled.");
            return;
        }
        if (sub === "off") {
            await settingsRepository.updateGroupSettings(group.id, { antiFloodEnabled: false });
            await ctx.reply("❌ Anti-flood protection disabled.");
            return;
        }
        if (sub === "limit") {
            const maxMsgs = Number.parseInt(args[1], 10);
            const windowSec = Number.parseInt(args[2], 10);
            if (!Number.isInteger(maxMsgs) || maxMsgs < 2 || !Number.isInteger(windowSec) || windowSec < 2) {
                await ctx.reply("Usage: /antiflood limit <maxMessages>=2+ <windowSeconds>=2+");
                return;
            }
            await settingsRepository.updateGroupSettings(group.id, {
                antiFloodMaxMessages: maxMsgs,
                antiFloodWindowSeconds: windowSec,
            });
            await ctx.reply(
                `✅ Anti-flood limit set to ${maxMsgs} messages per ${windowSec}s.`
            );
            return;
        }
        if (sub === "action") {
            const action = (args[1] || "").toUpperCase();
            if (!VALID_ACTIONS.has(action)) {
                await ctx.reply("Invalid action. Choose: delete, warn, or mute.");
                return;
            }
            await settingsRepository.updateGroupSettings(group.id, { antiFloodAction: action });
            await ctx.reply(`✅ Anti-flood action set to ${action}.`);
            return;
        }

        await ctx.reply(
            `Anti-Flood is currently ${settings.antiFloodEnabled ? "ON" : "OFF"}.\n` +
                `Limit: ${settings.antiFloodMaxMessages} messages / ${settings.antiFloodWindowSeconds}s\n` +
                `Action: ${settings.antiFloodAction}\n\n` +
                `Usage:\n/antiflood on | off\n/antiflood limit <msgs> <sec>\n/antiflood action <delete|warn|mute>`
        );
    },
};

