const { escapeHtml } = require("../utils/escapeMarkdown");
const { createChildLogger } = require("../utils/logger");

const svcLogger = createChildLogger("engagementService");

const DEFAULT_WELCOME_TEMPLATE =
    "Welcome {user} to <b>{group}</b>! 🎉\n\nYou are member #{count}.\nPlease read our group rules and enjoy your stay!";

const DEFAULT_GOODBYE_TEMPLATE = "Goodbye {user}! We will miss you in <b>{group}</b>. 👋";

/**
 * Render a welcome/goodbye template safely with HTML escaping.
 * Supported variables: {user}, {username}, {id}, {group}, {count}
 */
function formatTemplate(template, { user, groupTitle, memberCount = null }) {
    const displayName = escapeHtml(user?.first_name || "Member");
    const mention = user?.id
        ? `<a href="tg://user?id=${user.id}">${displayName}</a>`
        : displayName;
    const username = user?.username ? `@${escapeHtml(user.username)}` : displayName;
    const id = user?.id !== undefined ? escapeHtml(String(user.id)) : "";
    const group = escapeHtml(groupTitle || "this group");
    const count = memberCount !== null && memberCount !== undefined ? String(memberCount) : "?";

    return String(template || "")
        .replace(/\{user\}/gi, mention)
        .replace(/\{username\}/gi, username)
        .replace(/\{id\}/gi, id)
        .replace(/\{group\}/gi, group)
        .replace(/\{count\}/gi, count);
}

/**
 * Schedule automatic deletion of a sent bot message after `seconds`.
 * Uses `.unref()` so timers never keep the Node.js process alive on shutdown.
 */
function scheduleAutoDelete(telegram, chatId, messageId, seconds) {
    if (!messageId || !Number.isInteger(seconds) || seconds <= 0) {
        return;
    }

    const timer = setTimeout(async () => {
        try {
            await telegram.deleteMessage(chatId, messageId);
        } catch (err) {
            svcLogger.debug({ err, chatId, messageId }, "Auto-delete skipped");
        }
    }, seconds * 1000);

    if (typeof timer.unref === "function") {
        timer.unref();
    }
}

/**
 * Send a welcome message for a newly joined member if welcomeEnabled is true.
 */
async function sendWelcomeMessage({ ctx, settings, member, memberCount = null }) {
    if (!settings?.welcomeEnabled || !member) {
        return null;
    }

    const template = settings.welcomeMessage || DEFAULT_WELCOME_TEMPLATE;
    const text = formatTemplate(template, {
        user: member,
        groupTitle: ctx.chat?.title,
        memberCount,
    });

    let sent = null;
    if (settings.welcomeImageUrl) {
        try {
            sent = await ctx.replyWithPhoto(settings.welcomeImageUrl, {
                caption: text,
                parse_mode: "HTML",
            });
        } catch (err) {
            svcLogger.warn({ err, chatId: ctx.chat?.id }, "Welcome image failed, falling back to text");
            sent = await ctx.reply(text, { parse_mode: "HTML" });
        }
    } else {
        sent = await ctx.reply(text, { parse_mode: "HTML" });
    }

    if (sent?.message_id && settings.welcomeDeleteAfterSeconds > 0) {
        scheduleAutoDelete(
            ctx.telegram,
            ctx.chat.id,
            sent.message_id,
            settings.welcomeDeleteAfterSeconds
        );
    }

    return sent;
}

/**
 * Send a goodbye message when a member leaves if goodbyeEnabled is true.
 */
async function sendGoodbyeMessage({ ctx, settings, member }) {
    if (!settings?.goodbyeEnabled || !member) {
        return null;
    }

    const template = settings.goodbyeMessage || DEFAULT_GOODBYE_TEMPLATE;
    const text = formatTemplate(template, {
        user: member,
        groupTitle: ctx.chat?.title,
    });

    const sent = await ctx.reply(text, { parse_mode: "HTML" });

    if (sent?.message_id && settings.goodbyeDeleteAfterSeconds > 0) {
        scheduleAutoDelete(
            ctx.telegram,
            ctx.chat.id,
            sent.message_id,
            settings.goodbyeDeleteAfterSeconds
        );
    }

    return sent;
}

module.exports = {
    DEFAULT_WELCOME_TEMPLATE,
    DEFAULT_GOODBYE_TEMPLATE,
    formatTemplate,
    scheduleAutoDelete,
    sendWelcomeMessage,
    sendGoodbyeMessage,
};

