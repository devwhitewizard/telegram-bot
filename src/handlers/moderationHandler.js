const protectionService = require("../services/protectionService");
const captchaService = require("../services/captchaService");
const moderationService = require("../services/moderationService");
const trustedUserRepository = require("../database/repositories/trustedUserRepository");
const { createChildLogger } = require("../utils/logger");

const handlerLogger = createChildLogger("moderationHandler");
const ADMIN_STATUSES = new Set(["creator", "administrator"]);

/**
 * Handle new chat members for Anti-Raid and CAPTCHA verification.
 * Note: Welcome/goodbye messages will be added in Phase 6.
 */
async function handleNewMembers(ctx) {
    const group = ctx.state.group;
    const settings = ctx.state.groupSettings;
    const members = ctx.message?.new_chat_members;

    if (!group || !settings || !Array.isArray(members) || members.length === 0) {
        return;
    }

    const humanMembers = members.filter((m) => !m.is_bot);
    if (humanMembers.length === 0) {
        return;
    }

    // 1. Anti-raid detection
    if (settings.antiRaidEnabled) {
        const { raidTriggered, recentJoins } =
            await protectionService.recordJoinsAndCheckRaid(
                group,
                settings,
                humanMembers.length
            );

        if (raidTriggered) {
            settings.raidModeActive = true;
            await ctx.reply(
                `⚠️ Anti-Raid Alert: ${recentJoins} members joined within ${settings.raidWindowSeconds}s.\n` +
                    `Raid mode is now ACTIVE. New joins will be temporarily restricted.\n` +
                    `Administrators can disable it with /antiraid recover.`
            );
        }

        if (settings.raidModeActive) {
            for (const member of humanMembers) {
                try {
                    await ctx.telegram.restrictChatMember(ctx.chat.id, member.id, {
                        permissions: moderationService.MUTED_PERMISSIONS,
                    });
                } catch (err) {
                    handlerLogger.warn(
                        { err, chatId: ctx.chat.id, userId: member.id },
                        "Failed to restrict member during active raid mode"
                    );
                }
            }
            return;
        }
    }

    // 2. CAPTCHA verification for non-exempt new members
    if (settings.captchaEnabled) {
        for (const member of humanMembers) {
            try {
                const dbUser = await moderationService.ensureDbUser(member);
                const isTrusted = await trustedUserRepository.isTrustedUser(
                    group.id,
                    dbUser.id
                );
                if (isTrusted) {
                    continue;
                }

                const chatMember = await ctx.telegram
                    .getChatMember(ctx.chat.id, member.id)
                    .catch(() => null);
                if (chatMember && ADMIN_STATUSES.has(chatMember.status)) {
                    continue;
                }

                await captchaService.createAndSendCaptcha({
                    ctx,
                    group,
                    settings,
                    tgUser: member,
                });
            } catch (err) {
                handlerLogger.error(
                    { err, chatId: ctx.chat.id, userId: member.id },
                    "Failed to issue CAPTCHA for new member"
                );
            }
        }
    }
}

/**
 * Register moderation/protection update handlers on the Telegraf bot.
 * @param {import("telegraf").Telegraf} bot
 */
function registerCaptchaHandlers(bot) {
    bot.action(/^captcha:(\d+):(.+)$/, async (ctx) => {
        const group = ctx.state.group;
        if (!group) {
            await ctx.answerCbQuery("Group context unavailable.");
            return;
        }

        const targetTelegramId = ctx.match[1];
        const submittedAnswer = ctx.match[2];

        await captchaService.verifyCaptchaAttempt({
            ctx,
            group,
            targetTelegramId,
            submittedAnswer,
        });
    });
}

function registerModerationHandlers(bot) {
    bot.on("new_chat_members", handleNewMembers);
    registerCaptchaHandlers(bot);
}

module.exports = {
    handleNewMembers,
    registerCaptchaHandlers,
    registerModerationHandlers,
};

