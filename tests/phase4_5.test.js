const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const testDbPath = path.join(os.tmpdir(), `telegram-bot-p45-${Date.now()}.db`);
process.env.NODE_ENV = "test";
process.env.BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
process.env.DATABASE_URL = `file:${testDbPath}`;

const { initDatabase, disconnectDatabase } = require("../src/config/database");
const userRepository = require("../src/database/repositories/userRepository");
const groupRepository = require("../src/database/repositories/groupRepository");
const moderationRepository = require("../src/database/repositories/moderationRepository");
const temporaryModerationRepository = require("../src/database/repositories/temporaryModerationRepository");
const blockedWordRepository = require("../src/database/repositories/blockedWordRepository");
const trustedUserRepository = require("../src/database/repositories/trustedUserRepository");
const captchaRepository = require("../src/database/repositories/captchaRepository");

const moderationService = require("../src/services/moderationService");
const warningService = require("../src/services/warningService");
const protectionService = require("../src/services/protectionService");
const antiSpamService = require("../src/services/antiSpamService");
const antiLinkService = require("../src/services/antiLinkService");
const captchaService = require("../src/services/captchaService");

const { findBlockedWord } = require("../src/middlewares/badWordMiddleware");
const { processExpiredMutes } = require("../src/jobs/temporaryMuteJob");
const { processExpiredCaptchas } = require("../src/jobs/captchaCleanupJob");
const { parseDuration, formatDuration } = require("../src/utils/formatDuration");
const { createBot } = require("../src/bot");

function createMockCtx(overrides = {}) {
    return {
        botInfo: { id: 999000, first_name: "GroupBot", username: "group_bot" },
        chat: { id: -1001234567890, title: "Test Group", type: "supergroup" },
        from: { id: 1001, first_name: "AdminUser", username: "admin" },
        state: {},
        reply: jest.fn().mockResolvedValue({ message_id: 500 }),
        deleteMessage: jest.fn().mockResolvedValue(true),
        answerCbQuery: jest.fn().mockResolvedValue(true),
        telegram: {
            getMe: jest.fn().mockResolvedValue({ id: 999000 }),
            getChatMember: jest.fn().mockResolvedValue({ status: "member" }),
            banChatMember: jest.fn().mockResolvedValue(true),
            unbanChatMember: jest.fn().mockResolvedValue(true),
            restrictChatMember: jest.fn().mockResolvedValue(true),
            promoteChatMember: jest.fn().mockResolvedValue(true),
            getChatAdministrators: jest.fn().mockResolvedValue([]),
            deleteMessage: jest.fn().mockResolvedValue(true),
        },
        ...overrides,
    };
}

describe("Phase 4 + 5: Moderation & Group Protection", () => {
    let group;
    let adminDb;

    beforeAll(async () => {
        execSync(
            "npx prisma db push --schema=src/database/prisma/schema.prisma --skip-generate",
            {
                env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
                stdio: "pipe",
            }
        );
        await initDatabase();

        group = await groupRepository.registerGroup({
            telegramId: -1001234567890,
            title: "Test Group",
            type: "supergroup",
        });
        adminDb = await userRepository.createUser({
            telegramId: 1001,
            firstName: "AdminUser",
            username: "admin",
        });
    }, 30000);

    afterAll(async () => {
        await disconnectDatabase();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    beforeEach(() => {
        antiSpamService.clearTrackers();
        protectionService.clearJoinWindows();
    });

    test("1. Ban and unban persist ModerationLog and call Telegram API", async () => {
        const ctx = createMockCtx();
        const target = { id: 2001, first_name: "Spammer", username: "spammer" };

        await moderationService.banUser({
            ctx,
            group,
            targetTgUser: target,
            adminDbUser: adminDb,
            reason: "Posting scams",
        });

        expect(ctx.telegram.banChatMember).toHaveBeenCalledWith(
            ctx.chat.id,
            2001,
            {}
        );

        await moderationService.unbanUser({
            ctx,
            group,
            targetTgUser: target,
            adminDbUser: adminDb,
            reason: "Appealed",
        });

        expect(ctx.telegram.unbanChatMember).toHaveBeenCalledWith(
            ctx.chat.id,
            2001,
            { only_if_banned: true }
        );

        const logs = await moderationRepository.getModerationLogs(group.id);
        expect(logs.some((l) => l.action === "BAN" && l.reason === "Posting scams")).toBe(true);
        expect(logs.some((l) => l.action === "UNBAN")).toBe(true);
    });

    test("2. Kick removes a member without permanently banning them", async () => {
        const ctx = createMockCtx();
        const target = { id: 2002, first_name: "Troublemaker" };

        await moderationService.kickUser({
            ctx,
            group,
            targetTgUser: target,
            adminDbUser: adminDb,
            reason: "Disruptive",
        });

        expect(ctx.telegram.banChatMember).toHaveBeenCalledWith(ctx.chat.id, 2002);
        expect(ctx.telegram.unbanChatMember).toHaveBeenCalledWith(ctx.chat.id, 2002);
    });

    test("3 & 4. Mute, unmute, duration parsing, and temporary mute expiration", async () => {
        expect(parseDuration("10m")).toBe(600);
        expect(parseDuration("2h")).toBe(7200);
        expect(parseDuration("1d")).toBe(86400);
        expect(formatDuration(7200)).toBe("2 hours");

        const ctx = createMockCtx();
        const target = { id: 2003, first_name: "LoudUser" };

        const { targetDbUser } = await moderationService.muteUser({
            ctx,
            group,
            targetTgUser: target,
            adminDbUser: adminDb,
            reason: "Flooding",
            durationSeconds: 600,
        });

        expect(ctx.telegram.restrictChatMember).toHaveBeenCalledTimes(1);

        // Simulate expired temporary mute (force expiresAt in the past)
        await temporaryModerationRepository.createTemporaryModeration({
            groupId: group.id,
            userId: targetDbUser.id,
            action: "MUTE",
            expiresAt: new Date(Date.now() - 10_000),
            reason: "Expired test",
        });

        const mockBot = {
            telegram: {
                restrictChatMember: jest.fn().mockResolvedValue(true),
            },
        };

        const processed = await processExpiredMutes(mockBot, new Date());
        expect(processed).toBeGreaterThanOrEqual(1);
        expect(mockBot.telegram.restrictChatMember).toHaveBeenCalledWith(
            Number(group.telegramId),
            2003,
            { permissions: moderationService.RESTORED_PERMISSIONS }
        );

        await moderationService.unmuteUser({
            ctx,
            group,
            targetTgUser: target,
            adminDbUser: adminDb,
        });
        expect(ctx.telegram.restrictChatMember).toHaveBeenCalledTimes(2);
    });

    test("5 & 6. Warning thresholds, warning history, and clearing warnings", async () => {
        const ctx = createMockCtx();
        const target = { id: 2004, first_name: "WarnedUser" };
        const settings = { ...group.settings, maxWarnings: 3, warnAction: "MUTE", warnMuteMinutes: 15 };

        const r1 = await warningService.warnUser({
            ctx,
            group,
            settings,
            targetTgUser: target,
            adminDbUser: adminDb,
            reason: "Rule 1",
        });
        expect(r1.totalWarnings).toBe(1);
        expect(r1.autoAction).toBeNull();

        const history = await warningService.getUserWarnings(group.id, target);
        expect(history.warnings).toHaveLength(1);

        await warningService.warnUser({
            ctx,
            group,
            settings,
            targetTgUser: target,
            adminDbUser: adminDb,
            reason: "Rule 2",
        });

        const r3 = await warningService.warnUser({
            ctx,
            group,
            settings,
            targetTgUser: target,
            adminDbUser: adminDb,
            reason: "Rule 3",
        });

        expect(r3.totalWarnings).toBe(3);
        expect(r3.autoAction).not.toBeNull();
        expect(r3.autoAction.action).toBe("MUTE");
        expect(ctx.telegram.restrictChatMember).toHaveBeenCalled();

        // Warnings should be reset after threshold action
        const afterThreshold = await warningService.getUserWarnings(group.id, target);
        expect(afterThreshold.warnings).toHaveLength(0);
    });

    test("7. Bot permission checks & protection of owners/admins/self", async () => {
        const ctxMissingPerm = createMockCtx({
            telegram: {
                getMe: jest.fn().mockResolvedValue({ id: 999000 }),
                getChatMember: jest.fn().mockResolvedValue({
                    status: "administrator",
                    can_restrict_members: false,
                }),
            },
        });

        const perm = await moderationService.checkBotPermissions(ctxMissingPerm, [
            "can_restrict_members",
        ]);
        expect(perm.ok).toBe(false);

        const selfCheck = await moderationService.validateTarget(ctxMissingPerm, 999000);
        expect(selfCheck.ok).toBe(false);

        const ctxTargetAdmin = createMockCtx({
            telegram: {
                getMe: jest.fn().mockResolvedValue({ id: 999000 }),
                getChatMember: jest.fn().mockResolvedValue({ status: "creator" }),
            },
        });
        const ownerCheck = await moderationService.validateTarget(ctxTargetAdmin, 5555);
        expect(ownerCheck.ok).toBe(false);
    });

    test("8 & 9. Anti-spam and Anti-flood detection", () => {
        const now = 1_700_000_000_000;

        // Short trivial messages should not trigger spam
        expect(
            antiSpamService.checkSpam({
                chatId: -1001,
                userId: 10,
                text: "ok",
                threshold: 3,
                now,
            }).isSpam
        ).toBe(false);

        // Repeated identical spam messages
        expect(
            antiSpamService.checkSpam({
                chatId: -1001,
                userId: 10,
                text: "Buy cheap crypto now!!!",
                threshold: 3,
                now,
            }).isSpam
        ).toBe(false);
        expect(
            antiSpamService.checkSpam({
                chatId: -1001,
                userId: 10,
                text: "Buy cheap   crypto now!!!",
                threshold: 3,
                now: now + 1000,
            }).isSpam
        ).toBe(false);
        expect(
            antiSpamService.checkSpam({
                chatId: -1001,
                userId: 10,
                text: "buy cheap crypto now!!!",
                threshold: 3,
                now: now + 2000,
            }).isSpam
        ).toBe(true);

        // Anti-flood: 5 messages in 5s allowed, 6th triggers flood
        for (let i = 0; i < 5; i += 1) {
            expect(
                antiSpamService.checkFlood({
                    chatId: -1001,
                    userId: 11,
                    maxMessages: 5,
                    windowSeconds: 5,
                    now: now + i * 100,
                }).isFlood
            ).toBe(false);
        }
        expect(
            antiSpamService.checkFlood({
                chatId: -1001,
                userId: 11,
                maxMessages: 5,
                windowSeconds: 5,
                now: now + 600,
            }).isFlood
        ).toBe(true);
    });

    test("10. Anti-link inspects Telegram entities and respects allowed domains", () => {
        const msgWithTextLink = {
            text: "Check out this cool site",
            entities: [{ type: "text_link", offset: 15, length: 9, url: "https://evil.example.org/phish" }],
        };

        const blocked = antiLinkService.checkMessageLinks(msgWithTextLink, '["youtube.com"]');
        expect(blocked.hasProhibitedLink).toBe(true);
        expect(blocked.blockedDomains).toContain("evil.example.org");

        const msgAllowed = {
            caption: "Watch https://m.youtube.com/watch?v=123",
            caption_entities: [{ type: "url", offset: 6, length: 33 }],
        };
        const allowed = antiLinkService.checkMessageLinks(msgAllowed, '["youtube.com"]');
        expect(allowed.hasProhibitedLink).toBe(false);
    });

    test("11. Bad-word filter uses case-insensitive word-boundary matching and persists in SQLite", async () => {
        await blockedWordRepository.addBlockedWord(group.id, "badword");
        const list = await blockedWordRepository.listBlockedWords(group.id);
        const words = list.map((w) => w.word);

        expect(words).toContain("badword");
        expect(findBlockedWord("This is a BADWORD here!", words)).toBe("badword");
        expect(findBlockedWord("notbadwordish", words)).toBeNull();

        await blockedWordRepository.removeBlockedWord(group.id, "badword");
        expect(await blockedWordRepository.listBlockedWords(group.id)).toHaveLength(0);
    });

    test("12 & 15. CAPTCHA verification, button ownership check, and restart expiry recovery", async () => {
        const joiner = { id: 3001, first_name: "NewJoiner" };
        const ctx = createMockCtx({ from: joiner });

        const { record, challenge } = await captchaService.createAndSendCaptcha({
            ctx,
            group,
            settings: { captchaTimeoutSeconds: 120 },
            tgUser: joiner,
        });

        expect(ctx.telegram.restrictChatMember).toHaveBeenCalled();

        // Another user tries to click the button -> rejected
        const intruderCtx = createMockCtx({ from: { id: 9999, first_name: "Intruder" } });
        const intruderRes = await captchaService.verifyCaptchaAttempt({
            ctx: intruderCtx,
            group,
            targetTelegramId: joiner.id,
            submittedAnswer: challenge.answer,
        });
        expect(intruderRes.verified).toBe(false);
        expect(intruderRes.reason).toBe("wrong_user");

        // Correct user clicks correct answer -> verified
        const validCtx = createMockCtx({ from: joiner });
        const validRes = await captchaService.verifyCaptchaAttempt({
            ctx: validCtx,
            group,
            targetTelegramId: joiner.id,
            submittedAnswer: challenge.answer,
        });
        expect(validRes.verified).toBe(true);
        expect(validCtx.telegram.restrictChatMember).toHaveBeenCalled();

        // Restart recovery: create an expired unverified CAPTCHA and run cleanup job
        const expiredUser = await userRepository.createUser({
            telegramId: 3002,
            firstName: "ExpiredUser",
        });
        await captchaRepository.upsertCaptcha({
            groupId: group.id,
            userId: expiredUser.id,
            expectedAnswer: "10",
            messageId: 777,
            expiresAt: new Date(Date.now() - 5000),
        });

        const mockBot = {
            telegram: {
                banChatMember: jest.fn().mockResolvedValue(true),
                unbanChatMember: jest.fn().mockResolvedValue(true),
                deleteMessage: jest.fn().mockResolvedValue(true),
            },
        };
        const cleaned = await processExpiredCaptchas(mockBot, new Date());
        expect(cleaned).toBe(1);
        expect(mockBot.telegram.banChatMember).toHaveBeenCalledWith(
            Number(group.telegramId),
            3002
        );
        expect(record).toBeDefined();
    });

    test("13 & 14. Administrator/TrustedUser exemptions, Anti-raid detection, and command discovery", async () => {
        const trusted = await userRepository.createUser({
            telegramId: 4001,
            firstName: "TrustedMember",
        });
        await trustedUserRepository.addTrustedUser(group.id, trusted.id, adminDb.id);

        const ctxTrusted = createMockCtx({
            from: { id: 4001, first_name: "TrustedMember" },
        });
        expect(await protectionService.isUserExempt(ctxTrusted, group.id, trusted.id)).toBe(true);

        const raidRes = await protectionService.recordJoinsAndCheckRaid(
            group,
            { antiRaidEnabled: true, raidJoinThreshold: 3, raidWindowSeconds: 30, raidModeActive: false },
            3
        );
        expect(raidRes.raidTriggered).toBe(true);

        await protectionService.setRaidMode(group.id, false);

        // Verify all Phase 4+5 commands are discovered by createBot()
        const bot = createBot("123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
        for (const cmdName of [
            "ban",
            "unban",
            "kick",
            "mute",
            "unmute",
            "warn",
            "warnings",
            "clearwarns",
            "promote",
            "demote",
            "admins",
            "antispam",
            "antiflood",
            "antilink",
            "badwords",
            "addword",
            "removeword",
            "blockedwords",
            "antiraid",
            "captcha",
            "protection",
        ]) {
            expect(bot.context.commands.has(cmdName)).toBe(true);
        }
    });
});

