const { Markup } = require("telegraf");
const { parseCommandPermissions } = require("../services/settingsService");
const { escapeHtml } = require("../utils/escapeMarkdown");

const badge = (enabled) => (enabled ? "✅ ON" : "❌ OFF");

function buildSettingsView(menu, settings, groupTitle = "Group") {
    const title = escapeHtml(groupTitle);

    if (menu === "mod") {
        return {
            text:
                `🛡️ <b>Moderation Settings — ${title}</b>\n\n` +
                `• Max Warnings: <b>${settings.maxWarnings}</b>\n` +
                `• Threshold Action: <b>${settings.warnAction}</b>\n` +
                `• Auto-Mute Duration: <b>${settings.warnMuteMinutes} min</b>\n` +
                `• CAPTCHA on Join: ${badge(settings.captchaEnabled)}`,
            extra: {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback(`Max Warns: ${settings.maxWarnings}`, "cfg:cycle:maxWarnings:mod"),
                        Markup.button.callback(`Action: ${settings.warnAction}`, "cfg:cycle:warnAction:mod"),
                    ],
                    [
                        Markup.button.callback(`Mute: ${settings.warnMuteMinutes}m`, "cfg:cycle:warnMuteMinutes:mod"),
                        Markup.button.callback(`CAPTCHA: ${badge(settings.captchaEnabled)}`, "cfg:toggle:captchaEnabled:mod"),
                    ],
                    [Markup.button.callback("⬅️ Back", "cfg:menu:main")],
                ]),
            },
        };
    }

    if (menu === "prot") {
        return {
            text:
                `🧱 <b>Protection & Sensitivity — ${title}</b>\n\n` +
                `• Anti-Spam: ${badge(settings.antiSpamEnabled)} (${settings.antiSpamThreshold} msgs / ${settings.antiSpamWindowSeconds}s)\n` +
                `• Anti-Flood: ${badge(settings.antiFloodEnabled)} (${settings.antiFloodMaxMessages} msgs / ${settings.antiFloodWindowSeconds}s)\n` +
                `• Anti-Link: ${badge(settings.antiLinkEnabled)} (${settings.antiLinkAction})\n` +
                `• Bad-Word Filter: ${badge(settings.badWordFilterEnabled)}\n` +
                `• Anti-Raid: ${badge(settings.antiRaidEnabled)}`,
            extra: {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback(`Anti-Spam: ${badge(settings.antiSpamEnabled)}`, "cfg:toggle:antiSpamEnabled:prot"),
                        Markup.button.callback(`Anti-Flood: ${badge(settings.antiFloodEnabled)}`, "cfg:toggle:antiFloodEnabled:prot"),
                    ],
                    [
                        Markup.button.callback("Spam: Low", "cfg:spam:low"),
                        Markup.button.callback("Spam: Med", "cfg:spam:medium"),
                        Markup.button.callback("Spam: High", "cfg:spam:high"),
                    ],
                    [
                        Markup.button.callback("Flood: Low", "cfg:flood:low"),
                        Markup.button.callback("Flood: Med", "cfg:flood:medium"),
                        Markup.button.callback("Flood: High", "cfg:flood:high"),
                    ],
                    [
                        Markup.button.callback(`Anti-Link: ${badge(settings.antiLinkEnabled)}`, "cfg:toggle:antiLinkEnabled:prot"),
                        Markup.button.callback(`Link Act: ${settings.antiLinkAction}`, "cfg:cycle:antiLinkAction:prot"),
                    ],
                    [
                        Markup.button.callback(`Bad Words: ${badge(settings.badWordFilterEnabled)}`, "cfg:toggle:badWordFilterEnabled:prot"),
                        Markup.button.callback(`Anti-Raid: ${badge(settings.antiRaidEnabled)}`, "cfg:toggle:antiRaidEnabled:prot"),
                    ],
                    [Markup.button.callback("⬅️ Back", "cfg:menu:main")],
                ]),
            },
        };
    }

    if (menu === "welcome") {
        return {
            text:
                `👋 <b>Welcome & Goodbye — ${title}</b>\n\n` +
                `• Welcome Messages: ${badge(settings.welcomeEnabled)}\n` +
                `• Welcome Auto-Delete: <b>${settings.welcomeDeleteAfterSeconds}s</b>\n` +
                `• Goodbye Messages: ${badge(settings.goodbyeEnabled)}\n` +
                `• Goodbye Auto-Delete: <b>${settings.goodbyeDeleteAfterSeconds}s</b>\n\n` +
                `<i>Use /welcome set &lt;text&gt; or /goodbye set &lt;text&gt; to customize messages.</i>`,
            extra: {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback(`Welcome: ${badge(settings.welcomeEnabled)}`, "cfg:toggle:welcomeEnabled:welcome"),
                        Markup.button.callback(`Del: ${settings.welcomeDeleteAfterSeconds}s`, "cfg:cycle:welcomeDeleteAfterSeconds:welcome"),
                    ],
                    [
                        Markup.button.callback(`Goodbye: ${badge(settings.goodbyeEnabled)}`, "cfg:toggle:goodbyeEnabled:welcome"),
                        Markup.button.callback(`Del: ${settings.goodbyeDeleteAfterSeconds}s`, "cfg:cycle:goodbyeDeleteAfterSeconds:welcome"),
                    ],
                    [Markup.button.callback("⬅️ Back", "cfg:menu:main")],
                ]),
            },
        };
    }

    if (menu === "games") {
        return {
            text:
                `🎮 <b>Games, Fun & Activity — ${title}</b>\n\n` +
                `• Group Games (/quiz, /trivia, /tictactoe, etc.): ${badge(settings.gamesEnabled)}\n` +
                `• Entertainment (/joke, /fact, /roast, etc.): ${badge(settings.funEnabled)}\n` +
                `• Activity Tracking: ${badge(settings.activityTrackingEnabled)}`,
            extra: {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard([
                    [Markup.button.callback(`Games: ${badge(settings.gamesEnabled)}`, "cfg:toggle:gamesEnabled:games")],
                    [Markup.button.callback(`Fun Commands: ${badge(settings.funEnabled)}`, "cfg:toggle:funEnabled:games")],
                    [Markup.button.callback(`Activity Tracking: ${badge(settings.activityTrackingEnabled)}`, "cfg:toggle:activityTrackingEnabled:games")],
                    [Markup.button.callback("⬅️ Back", "cfg:menu:main")],
                ]),
            },
        };
    }

    if (menu === "perms") {
        const perms = parseCommandPermissions(settings.commandPermissions);
        const entries = Object.entries(perms);
        const list =
            entries.length > 0
                ? entries.map(([cmd, lvl]) => `• <code>/${escapeHtml(cmd)}</code> → <b>${lvl}</b>`).join("\n")
                : "No custom command overrides set (default permissions apply).";

        return {
            text:
                `🔐 <b>Command Permissions — ${title}</b>\n\n` +
                `${list}\n\n` +
                `<i>Use /cmdperm &lt;command&gt; &lt;everyone|admin|disabled&gt; to configure.</i>`,
            extra: {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard([[Markup.button.callback("⬅️ Back", "cfg:menu:main")]]),
            },
        };
    }

    // Default: Main menu
    return {
        text:
            `⚙️ <b>Group Settings — ${title}</b>\n\n` +
            `• Welcome: ${badge(settings.welcomeEnabled)} | Goodbye: ${badge(settings.goodbyeEnabled)}\n` +
            `• Anti-Spam: ${badge(settings.antiSpamEnabled)} | Anti-Flood: ${badge(settings.antiFloodEnabled)}\n` +
            `• Anti-Link: ${badge(settings.antiLinkEnabled)} | Bad Words: ${badge(settings.badWordFilterEnabled)}\n` +
            `• Games: ${badge(settings.gamesEnabled)} | Fun: ${badge(settings.funEnabled)}\n\n` +
            `Choose a category below:`,
        extra: {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback("🛡️ Moderation", "cfg:menu:mod"),
                    Markup.button.callback("🧱 Protection", "cfg:menu:prot"),
                ],
                [
                    Markup.button.callback("👋 Welcome & Goodbye", "cfg:menu:welcome"),
                    Markup.button.callback("🎮 Games & Fun", "cfg:menu:games"),
                ],
                [Markup.button.callback("🔐 Command Permissions", "cfg:menu:perms")],
                [Markup.button.callback("❌ Close", "cfg:close")],
            ]),
        },
    };
}

module.exports = {
    buildSettingsView,
};

