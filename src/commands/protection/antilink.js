const settingsRepository = require("../../database/repositories/settingsRepository");
const antiLinkService = require("../../services/antiLinkService");
const { getCommandArgs } = require("../../utils/extractUser");

const VALID_ACTIONS = new Set(["DELETE", "WARN", "MUTE"]);

module.exports = {
    name: "antilink",
    description: "Configure anti-link protection and allowed domains",
    groupOnly: true,
    adminOnly: true,
    execute: async (ctx) => {
        const args = getCommandArgs(ctx);
        const group = ctx.state.group;
        const settings = ctx.state.groupSettings;
        const sub = (args[0] || "").toLowerCase();

        if (sub === "on") {
            await settingsRepository.updateGroupSettings(group.id, { antiLinkEnabled: true });
            await ctx.reply("✅ Anti-link protection enabled.");
            return;
        }
        if (sub === "off") {
            await settingsRepository.updateGroupSettings(group.id, { antiLinkEnabled: false });
            await ctx.reply("❌ Anti-link protection disabled.");
            return;
        }
        if (sub === "allow" && args[1]) {
            const domain = antiLinkService.extractHostname(args[1]) || args[1].trim().toLowerCase();
            const current = new Set(antiLinkService.parseAllowedDomains(settings.allowedDomains));
            current.add(domain);
            await settingsRepository.updateGroupSettings(group.id, {
                allowedDomains: JSON.stringify(Array.from(current)),
            });
            await ctx.reply(`✅ Added "${domain}" to allowed domains.`);
            return;
        }
        if (sub === "disallow" && args[1]) {
            const domain = antiLinkService.extractHostname(args[1]) || args[1].trim().toLowerCase();
            const current = new Set(antiLinkService.parseAllowedDomains(settings.allowedDomains));
            current.delete(domain);
            await settingsRepository.updateGroupSettings(group.id, {
                allowedDomains: JSON.stringify(Array.from(current)),
            });
            await ctx.reply(`✅ Removed "${domain}" from allowed domains.`);
            return;
        }
        if (sub === "action") {
            const action = (args[1] || "").toUpperCase();
            if (!VALID_ACTIONS.has(action)) {
                await ctx.reply("Invalid action. Choose: delete, warn, or mute.");
                return;
            }
            await settingsRepository.updateGroupSettings(group.id, { antiLinkAction: action });
            await ctx.reply(`✅ Anti-link action set to ${action}.`);
            return;
        }

        const allowed = antiLinkService.parseAllowedDomains(settings.allowedDomains);
        await ctx.reply(
            `Anti-Link is currently ${settings.antiLinkEnabled ? "ON" : "OFF"}.\n` +
                `Action: ${settings.antiLinkAction}\n` +
                `Allowed domains: ${allowed.length > 0 ? allowed.join(", ") : "None"}\n\n` +
                `Usage:\n/antilink on | off\n/antilink allow <domain>\n/antilink disallow <domain>\n/antilink action <delete|warn|mute>`
        );
    },
};

