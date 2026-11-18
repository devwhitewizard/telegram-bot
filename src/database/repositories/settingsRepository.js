const { getPrisma } = require("../../config/database");
const { toPositiveInt } = require("./helpers");

const ALLOWED_SETTINGS_FIELDS = new Set([
    "welcomeEnabled",
    "goodbyeEnabled",
    "antiSpamEnabled",
    "antiFloodEnabled",
    "antiLinkEnabled",
    "badWordFilterEnabled",
    "captchaEnabled",
    "antiRaidEnabled",
    "raidModeActive",
    "welcomeMessage",
    "goodbyeMessage",
    "welcomeImageUrl",
    "welcomeDeleteAfterSeconds",
    "goodbyeDeleteAfterSeconds",
    "activityTrackingEnabled",
    "gamesEnabled",
    "funEnabled",
    "commandPermissions",
    "rules",
    "maxWarnings",
    "warnAction",
    "warnMuteMinutes",
    "antiSpamThreshold",
    "antiSpamWindowSeconds",
    "antiFloodMaxMessages",
    "antiFloodWindowSeconds",
    "antiFloodAction",
    "antiLinkAction",
    "allowedDomains",
    "raidJoinThreshold",
    "raidWindowSeconds",
    "captchaTimeoutSeconds",
    "captchaAction",
]);

/**
 * Retrieve settings for a group (creating defaults if none exist yet).
 * Returns null if the group itself does not exist.
 *
 * @param {number} groupId - Internal Group.id
 */
async function getGroupSettings(groupId) {
    const id = toPositiveInt(groupId, "groupId");
    const prisma = getPrisma();

    const group = await prisma.group.findUnique({
        where: { id },
        include: { settings: true },
    });

    if (!group) {
        return null;
    }

    if (group.settings) {
        return group.settings;
    }

    return prisma.groupSettings.create({
        data: { groupId: id },
    });
}

/**
 * Update whitelisted settings fields for a group.
 *
 * @param {number} groupId - Internal Group.id
 * @param {Record<string, unknown>} updates
 */
async function updateGroupSettings(groupId, updates = {}) {
    const id = toPositiveInt(groupId, "groupId");
    const prisma = getPrisma();

    const sanitized = {};
    for (const [key, value] of Object.entries(updates)) {
        if (ALLOWED_SETTINGS_FIELDS.has(key) && value !== undefined) {
            sanitized[key] = value;
        }
    }

    if (
        sanitized.maxWarnings !== undefined &&
        (!Number.isInteger(sanitized.maxWarnings) || sanitized.maxWarnings < 1)
    ) {
        throw new TypeError("maxWarnings must be an integer >= 1");
    }

    const existingGroup = await prisma.group.findUnique({ where: { id } });
    if (!existingGroup) {
        throw new Error(`Group with id ${id} not found`);
    }

    return prisma.groupSettings.upsert({
        where: { groupId: id },
        update: sanitized,
        create: {
            groupId: id,
            ...sanitized,
        },
    });
}

module.exports = {
    getGroupSettings,
    updateGroupSettings,
};

