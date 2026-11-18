const fs = require("fs");
const os = require("os");
const path = require("path");

// Configure isolated test environment before importing app modules
const testDbPath = path.join(os.tmpdir(), `telegram-bot-test-${Date.now()}.db`);
process.env.NODE_ENV = "test";
process.env.BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
process.env.DATABASE_URL = `file:${testDbPath}`;

const { execSync } = require("child_process");
const { initDatabase, disconnectDatabase, getPrisma } = require("../src/config/database");
const userRepository = require("../src/database/repositories/userRepository");
const groupRepository = require("../src/database/repositories/groupRepository");
const settingsRepository = require("../src/database/repositories/settingsRepository");
const warningRepository = require("../src/database/repositories/warningRepository");
const moderationRepository = require("../src/database/repositories/moderationRepository");
const gameRepository = require("../src/database/repositories/gameRepository");
const errorMiddleware = require("../src/middlewares/errorMiddleware");
const userRegistrationMiddleware = require("../src/middlewares/userRegistrationMiddleware");
const groupRegistrationMiddleware = require("../src/middlewares/groupRegistrationMiddleware");
const groupMiddleware = require("../src/middlewares/groupMiddleware");
const privateChatMiddleware = require("../src/middlewares/privateChatMiddleware");
const adminMiddleware = require("../src/middlewares/adminMiddleware");
const { createCooldownMiddleware } = require("../src/middlewares/cooldownMiddleware");
const {
    loadCommands,
    validateCommandModule,
    registerCommands,
} = require("../src/commands");
const { createBot } = require("../src/bot");

describe("Phase 2 + 3: Database, Repositories, Middleware & Command Registry", () => {
    beforeAll(async () => {
        execSync(
            "npx prisma db push --schema=src/database/prisma/schema.prisma --skip-generate",
            {
                env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
                stdio: "pipe",
            }
        );
        await initDatabase();
    }, 30000);

    afterAll(async () => {
        await disconnectDatabase();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    describe("Database & Repositories", () => {
        test("creates and retrieves a user with a 64-bit Telegram ID", async () => {
            const largeTgId = 7123456789; // Exceeds 32-bit signed int max (2,147,483,647)
            const user = await userRepository.createUser({
                telegramId: largeTgId,
                username: "alice_tg",
                firstName: "Alice",
                lastName: "Smith",
            });

            expect(user.telegramId).toBe(BigInt(largeTgId));
            expect(user.username).toBe("alice_tg");

            const found = await userRepository.findUserByTelegramId(largeTgId);
            expect(found).not.toBeNull();
            expect(found.id).toBe(user.id);
        });

        test("registers a group and initializes default GroupSettings", async () => {
            const groupTgId = -1001987654321;
            const group = await groupRepository.registerGroup({
                telegramId: groupTgId,
                title: "Test Supergroup",
                username: "test_supergroup",
                type: "supergroup",
            });

            expect(group.telegramId).toBe(BigInt(groupTgId));
            expect(group.settings).not.toBeNull();
            expect(group.settings.welcomeEnabled).toBe(true);
            expect(group.settings.maxWarnings).toBe(3);

            const updated = await settingsRepository.updateGroupSettings(group.id, {
                antiSpamEnabled: true,
                maxWarnings: 5,
                rules: "Be respectful.",
            });
            expect(updated.antiSpamEnabled).toBe(true);
            expect(updated.maxWarnings).toBe(5);
            expect(updated.rules).toBe("Be respectful.");
        });

        test("creates, retrieves, and clears warnings", async () => {
            const group = await groupRepository.registerGroup({
                telegramId: -1001112223334,
                title: "Moderation Group",
                type: "supergroup",
            });
            const admin = await userRepository.createUser({
                telegramId: 5000000001,
                firstName: "Admin",
            });
            const target = await userRepository.createUser({
                telegramId: 5000000002,
                firstName: "Target",
            });

            await warningRepository.createWarning({
                groupId: group.id,
                userId: target.id,
                issuedBy: admin.id,
                reason: "Spamming links",
            });

            const warnings = await warningRepository.getWarnings(group.id, target.id);
            expect(warnings).toHaveLength(1);
            expect(warnings[0].reason).toBe("Spamming links");

            const cleared = await warningRepository.clearWarnings(group.id, target.id);
            expect(cleared.count).toBe(1);
            expect(await warningRepository.countWarnings(group.id, target.id)).toBe(0);
        });

        test("records moderation logs and game scores / leaderboard", async () => {
            const group = await groupRepository.registerGroup({
                telegramId: -1004445556667,
                title: "Game & Audit Group",
                type: "group",
            });
            const admin = await userRepository.createUser({
                telegramId: 6000000001,
                firstName: "Mod",
            });
            const player = await userRepository.createUser({
                telegramId: 6000000002,
                firstName: "PlayerOne",
            });

            const log = await moderationRepository.createModerationLog({
                groupId: group.id,
                targetUserId: player.id,
                adminUserId: admin.id,
                action: "mute",
                reason: "Flooding",
            });
            expect(log.action).toBe("MUTE");

            const logs = await moderationRepository.getModerationLogs(group.id);
            expect(logs).toHaveLength(1);

            await gameRepository.saveGameScore({
                groupId: group.id,
                userId: player.id,
                game: "trivia",
                score: 10,
            });
            await gameRepository.saveGameScore({
                groupId: group.id,
                userId: player.id,
                game: "trivia",
                score: 15,
            });

            const leaderboard = await gameRepository.getLeaderboard(group.id, "trivia");
            expect(leaderboard).toHaveLength(1);
            expect(leaderboard[0].totalScore).toBe(25);
            expect(leaderboard[0].user.firstName).toBe("PlayerOne");
        });
    });

    describe("Middleware Architecture & Execution Order", () => {
        test("errorMiddleware catches downstream errors and replies safely", async () => {
            const reply = jest.fn().mockResolvedValue(true);
            const ctx = { chat: { id: 123 }, from: { id: 456 }, reply };

            await errorMiddleware(ctx, async () => {
                throw new Error("Sensitive internal DB error");
            });

            expect(reply).toHaveBeenCalledTimes(1);
            expect(reply.mock.calls[0][0]).not.toContain("Sensitive internal DB error");
        });

        test("userRegistrationMiddleware and groupRegistrationMiddleware populate ctx.state", async () => {
            const ctx = {
                from: { id: 7000000001, first_name: "Bob", username: "bob" },
                chat: { id: -1007778889990, title: "Middleware Group", type: "supergroup" },
                state: {},
            };
            const next = jest.fn().mockResolvedValue(undefined);

            await userRegistrationMiddleware(ctx, async () => {
                await groupRegistrationMiddleware(ctx, next);
            });

            expect(next).toHaveBeenCalledTimes(1);
            expect(ctx.state.user).toBeDefined();
            expect(ctx.state.user.firstName).toBe("Bob");
            expect(ctx.state.group).toBeDefined();
            expect(ctx.state.groupSettings).toBeDefined();
        });

        test("groupMiddleware and privateChatMiddleware enforce chat types", async () => {
            const next = jest.fn();
            const reply = jest.fn().mockResolvedValue(true);

            await groupMiddleware({ chat: { type: "private" }, reply }, next);
            expect(next).not.toHaveBeenCalled();

            await groupMiddleware({ chat: { type: "supergroup" }, reply }, next);
            expect(next).toHaveBeenCalledTimes(1);

            await privateChatMiddleware({ chat: { type: "group" }, reply }, next);
            expect(next).toHaveBeenCalledTimes(1);

            await privateChatMiddleware({ chat: { type: "private" }, reply }, next);
            expect(next).toHaveBeenCalledTimes(2);
        });

        test("adminMiddleware verifies admin status via getChatMember", async () => {
            const next = jest.fn();
            const reply = jest.fn().mockResolvedValue(true);

            const nonAdminCtx = {
                chat: { id: -1001, type: "supergroup" },
                from: { id: 42 },
                state: {},
                reply,
                telegram: {
                    getChatMember: jest.fn().mockResolvedValue({ status: "member" }),
                },
            };
            await adminMiddleware(nonAdminCtx, next);
            expect(next).not.toHaveBeenCalled();
            expect(reply).toHaveBeenCalled();

            const adminCtx = {
                chat: { id: -1001, type: "supergroup" },
                from: { id: 99 },
                state: {},
                reply,
                telegram: {
                    getChatMember: jest.fn().mockResolvedValue({ status: "administrator" }),
                },
            };
            await adminMiddleware(adminCtx, next);
            expect(next).toHaveBeenCalledTimes(1);
            expect(adminCtx.state.member.status).toBe("administrator");
        });

        test("cooldownMiddleware blocks rapid repeated calls", async () => {
            const mw = createCooldownMiddleware(5);
            const next = jest.fn();
            const reply = jest.fn().mockResolvedValue(true);
            const ctx = {
                chat: { id: 10 },
                from: { id: 20 },
                message: { text: "/ping" },
                reply,
            };

            await mw(ctx, next);
            await mw(ctx, next);

            expect(next).toHaveBeenCalledTimes(1);
            expect(reply).toHaveBeenCalledTimes(1);
        });
    });

    describe("Centralized Command Registration", () => {
        test("loadCommands discovers baseline commands", () => {
            const commands = loadCommands();
            expect(commands.has("start")).toBe(true);
            expect(commands.has("help")).toBe(true);
            expect(commands.has("ping")).toBe(true);
        });

        test("validateCommandModule rejects invalid command definitions", () => {
            expect(() => validateCommandModule(null, "bad.js")).toThrow();
            expect(() =>
                validateCommandModule({ name: "x", description: "y" }, "bad.js")
            ).toThrow(/execute/);
            expect(() =>
                validateCommandModule(
                    {
                        name: "x",
                        description: "y",
                        groupOnly: true,
                        privateOnly: true,
                        execute: () => {},
                    },
                    "bad.js"
                )
            ).toThrow(/groupOnly/);
        });

        test("createBot registers middleware and commands cleanly", () => {
            const bot = createBot("123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
            expect(bot.context.commands.size).toBeGreaterThanOrEqual(3);
            expect(Array.isArray(bot.menuCommands)).toBe(true);
            expect(getPrisma()).toBeDefined();
        });
    });
});

