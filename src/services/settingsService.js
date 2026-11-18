const settingsRepository = require("../database/repositories/settingsRepository");

const TOGGLEABLE_FIELDS = new Set([
    "welcomeEnabled",
    "goodbyeEnabled",
    "antiSpamEnabled",
    "antiFloodEnabled",
    "antiLinkEnabled",
    "badWordFilterEnabled",
    "captchaEnabled",
    "antiRaidEnabled",
    "activityTrackingEnabled",
    "gamesEnabled",
    "funEnabled",
]);

const CYCLE_OPTIONS = {
    maxWarnings: [2, 3, 5, 10],
    warnAction: ["MUTE", "KICK", "BAN"],
    warnMuteMinutes: [15, 30, 60, 120],
    antiLinkAction: ["DELETE", "WARN", "MUTE"],
    antiFloodAction: ["DELETE", "WARN", "MUTE"],
    welcomeDeleteAfterSeconds: [0, 30, 60, 300],
    goodbyeDeleteAfterSeconds: [0, 30, 60, 300],
};

const ANTISPAM_PRESETS = {
    low: { antiSpamThreshold: 5, antiSpamWindowSeconds: 60 },
    medium: { antiSpamThreshold: 3, antiSpamWindowSeconds: 30 },
    high: { antiSpamThreshold: 2, antiSpamWindowSeconds: 15 },
};

const ANTIFLOOD_PRESETS = {
    low: { antiFloodMaxMessages: 8, antiFloodWindowSeconds: 5 },
    medium: { antiFloodMaxMessages: 5, antiFloodWindowSeconds: 5 },
    high: { antiFloodMaxMessages: 3, antiFloodWindowSeconds: 5 },
};

const VALID_PERM_LEVELS = new Set(["everyone", "admin", "disabled"]);

function parseCommandPermissions(raw) {
    if (!raw) return {};
    if (typeof raw === "object" && !Array.isArray(raw)) return { ...raw };
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

function getCommandPermission(settings, commandName) {
    if (!settings) return "everyone";
    const perms = parseCommandPermissions(settings.commandPermissions);
    const val = perms[String(commandName).toLowerCase()];
    return VALID_PERM_LEVELS.has(val) ? val : "everyone";
}

async function setCommandPermission(groupId, settings, commandName, level) {
    const cleanCmd = String(commandName).trim().toLowerCase().replace(/^\//, "");
    const cleanLevel = String(level).trim().toLowerCase();
    if (!VALID_PERM_LEVELS.has(cleanLevel)) {
        throw new TypeError("Permission level must be: everyone, admin, or disabled");
    }

    const perms = parseCommandPermissions(settings?.commandPermissions);
    if (cleanLevel === "everyone") {
        delete perms[cleanCmd];
    } else {
        perms[cleanCmd] = cleanLevel;
    }

    return settingsRepository.updateGroupSettings(groupId, {
        commandPermissions: JSON.stringify(perms),
    });
}

async function toggleSetting(groupId, settings, field) {
    if (!TOGGLEABLE_FIELDS.has(field)) {
        throw new TypeError(`Field "${field}" cannot be toggled`);
    }
    const nextValue = !Boolean(settings[field]);
    return settingsRepository.updateGroupSettings(groupId, { [field]: nextValue });
}

async function cycleSetting(groupId, settings, field) {
    const options = CYCLE_OPTIONS[field];
    if (!options) {
        throw new TypeError(`Field "${field}" is not cyclable`);
    }
    const currentIdx = options.indexOf(settings[field]);
    const nextValue = options[(currentIdx + 1) % options.length];
    return settingsRepository.updateGroupSettings(groupId, { [field]: nextValue });
}

async function applyAntiSpamPreset(groupId, preset) {
    const config = ANTISPAM_PRESETS[preset];
    if (!config) {
        throw new TypeError(`Unknown anti-spam preset "${preset}"`);
    }
    return settingsRepository.updateGroupSettings(groupId, config);
}

async function applyAntiFloodPreset(groupId, preset) {
    const config = ANTIFLOOD_PRESETS[preset];
    if (!config) {
        throw new TypeError(`Unknown anti-flood preset "${preset}"`);
    }
    return settingsRepository.updateGroupSettings(groupId, config);
}

module.exports = {
    TOGGLEABLE_FIELDS,
    CYCLE_OPTIONS,
    ANTISPAM_PRESETS,
    ANTIFLOOD_PRESETS,
    parseCommandPermissions,
    getCommandPermission,
    setCommandPermission,
    toggleSetting,
    cycleSetting,
    applyAntiSpamPreset,
    applyAntiFloodPreset,
};

