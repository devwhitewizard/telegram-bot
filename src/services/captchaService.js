const { Markup } = require("telegraf");
const captchaRepository = require("../database/repositories/captchaRepository");
const moderationService = require("./moderationService");
const { escapeHtml } = require("../utils/escapeMarkdown");
const { createChildLogger } = require("../utils/logger");

const svcLogger = createChildLogger("captchaService");

/**
 * Generate a simple arithmetic CAPTCHA challenge with 4 unique choices.
 * @returns {{ question: string, answer: string, choices: string[] }}
 */
function generateChallenge() {
    const a = Math.floor(Math.random() * 12) + 2;
    const b = Math.floor(Math.random() * 12) + 2;
    const correct = a + b;

    const options = new Set([correct]);
    while (options.size < 4) {
        const offset = Math.floor(Math.random() * 7) - 3;
        const candidate = correct + (offset === 0 ? 4 : offset);
        if (candidate > 0) {
            options.add(candidate);
        }
    }

    const choices = Array.from(options).sort(() => Math.random() - 0.5).map(String);

    return {
        question: `${a} + ${b}`,
        answer: String(correct),
        choices,
    };
}

/**
 * Issue a CAPTCHA verification challenge for a newly joined user:
 * 1. Restrict the user from sending messages until verified.
 * 2. Persist the challenge and expiry timestamp in SQLite.
 * 3. Send an inline keyboard prompt targeted to that user.
 */
async function createAndSendCaptcha({ ctx, group, settings, tgUser }) {
    const targetDbUser = await moderationService.ensureDbUser(tgUser);
    const timeoutSeconds = settings?.captchaTimeoutSeconds || 120;
    const expiresAt = new Date(Date.now() + timeoutSeconds * 1000);
    const challenge = generateChallenge();

    const record = await captchaRepository.upsertCaptcha({
        groupId: group.id,
        userId: targetDbUser.id,
        expectedAnswer: challenge.answer,
        expiresAt,
    });

    // Restrict user until verified (if bot has permission)
    try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, tgUser.id, {
            permissions: moderationService.MUTED_PERMISSIONS,
        });
    } catch (err) {
        svcLogger.warn(
            { err, chatId: ctx.chat.id, userId: tgUser.id },
            "Could not restrict new member before CAPTCHA"
        );
    }

    const buttons = challenge.choices.map((choice) =>
        Markup.button.callback(choice, `captcha:${tgUser.id}:${choice}`)
    );

    const mention = `<a href="tg://user?id=${tgUser.id}">${escapeHtml(
        tgUser.first_name || "New Member"
    )}</a>`;

    const sent = await ctx.reply(
        `Welcome ${mention}! Please verify you are human within ${timeoutSeconds}s.\n\n` +
            `What is <b>${challenge.question}</b>?`,
        {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([buttons]),
        }
    );

    if (sent?.message_id) {
        await captchaRepository.setCaptchaMessageId(record.id, sent.message_id);
    }

    return { record, challenge, messageId: sent?.message_id };
}

/**
 * Verify a user's inline button click on a CAPTCHA prompt.
 */
async function verifyCaptchaAttempt({ ctx, group, targetTelegramId, submittedAnswer }) {
    if (String(ctx.from.id) !== String(targetTelegramId)) {
        await ctx.answerCbQuery("This verification button is not for you.", {
            show_alert: true,
        });
        return { verified: false, reason: "wrong_user" };
    }

    const userDb = ctx.state.user || (await moderationService.ensureDbUser(ctx.from));
    const pending = await captchaRepository.findPendingCaptcha(group.id, userDb.id);

    if (!pending) {
        await ctx.answerCbQuery("No active verification found or already verified.");
        return { verified: false, reason: "not_found" };
    }

    if (new Date() > pending.expiresAt) {
        await ctx.answerCbQuery("This verification has expired.", { show_alert: true });
        return { verified: false, reason: "expired" };
    }

    if (String(submittedAnswer) !== pending.expectedAnswer) {
        await ctx.answerCbQuery("Incorrect answer. Please try again!", {
            show_alert: true,
        });
        return { verified: false, reason: "wrong_answer" };
    }

    await captchaRepository.markCaptchaVerified(pending.id);

    try {
        await ctx.telegram.restrictChatMember(ctx.chat.id, ctx.from.id, {
            permissions: moderationService.RESTORED_PERMISSIONS,
        });
    } catch (err) {
        svcLogger.warn(
            { err, chatId: ctx.chat.id, userId: ctx.from.id },
            "Failed to restore permissions after CAPTCHA verification"
        );
    }

    await ctx.answerCbQuery("Verification successful! Welcome to the group.");

    try {
        await ctx.deleteMessage();
    } catch {
        // Ignore if bot cannot delete the message
    }

    return { verified: true };
}

module.exports = {
    generateChallenge,
    createAndSendCaptcha,
    verifyCaptchaAttempt,
};

