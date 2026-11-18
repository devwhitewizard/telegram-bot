const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const testDbPath = path.join(os.tmpdir(), `telegram-bot-p78-${Date.now()}.db`);
process.env.NODE_ENV = "test";
process.env.BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
process.env.DATABASE_URL = `file:${testDbPath}`;

const { initDatabase, disconnectDatabase } = require("../src/config/database");
const userRepository = require("../src/database/repositories/userRepository");
const groupRepository = require("../src/database/repositories/groupRepository");
const settingsRepository = require("../src/database/repositories/settingsRepository");
const gameSessionRepository = require("../src/database/repositories/gameSessionRepository");

const engagementService = require("../src/services/engagementService");
const activityService = require("../src/services/activityService");
const scoreService = require("../src/services/scoreService");
const gameService = require("../src/services/gameService");

const { handleMemberJoin, handleMemberLeave } = require("../src/handlers/memberHandler");
const { parseChooseOptions } = require("../src/commands/fun/choose");
const rollCommand = require("../src/commands/fun/roll");
const eightBallCommand = require("../src/commands/fun/eightball");
const jokeCommand = require("../src/commands/fun/joke");
const { createBot } = require("../src/bot");

describe("Phase 7 & 8: Welcome, Engagement, Games & Entertainment", () => {
    let group;
    let user1;
    let user2;

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
            telegramId: -1009998887771,
            title: "Engagement <Test> Group",
            type: "supergroup",
        });
        user1 = await userRepository.createUser({
            telegramId: 8001,
            firstName: "Alice",
            username: "alice_dev",
        });
        user2 = await userRepository.createUser({
            telegramId: 8002,
            firstName: "Bob",
            username: "bob_dev",
        });
    }, 30000);

    afterAll(async () => {
        await disconnectDatabase();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    beforeEach(() => {
        activityService.clearActivityBuffer();
    });

    test("1. Welcome message formatting escapes HTML and replaces all template variables", () => {
        const formatted = engagementService.formatTemplate(
            "Hi {user} ({username}, {id}) in {group}! #{count}",
            {
                user: { id: 8001, first_name: "A<script>", username: "alice_dev" },
                groupTitle: "Dev & Fun",
                memberCount: 42,
            }
        );

        expect(formatted).toContain("A&lt;script&gt;");
        expect(formatted).toContain("@alice_dev");
        expect(formatted).toContain("8001");
        expect(formatted).toContain("Dev &amp; Fun");
        expect(formatted).toContain("#42");
    });

    test("2. Welcome/goodbye settings and member join/leave handling", async () => {
        const updated = await settingsRepository.updateGroupSettings(group.id, {
            welcomeEnabled: true,
            goodbyeEnabled: true,
            welcomeMessage: "Welcome {user} to {group}!",
            goodbyeMessage: "Bye {user}!",
        });
        expect(updated.goodbyeEnabled).toBe(true);

        const reply = jest.fn().mockResolvedValue({ message_id: 101 });
        const joinCtx = {
            botInfo: { id: 999000 },
            chat: { id: Number(group.telegramId), title: group.title, type: "supergroup" },
            message: {
                new_chat_members: [
                    { id: 8001, first_name: "Alice", is_bot: false },
                    { id: 8002, first_name: "Bob", is_bot: false },
                ],
            },
            state: { group, groupSettings: updated },
            reply,
            telegram: {
                getChatMembersCount: jest.fn().mockResolvedValue(25),
            },
        };

        await handleMemberJoin(joinCtx);
        expect(reply).toHaveBeenCalledTimes(2);

        // Goodbye ignores bot departures
        const botLeaveCtx = {
            botInfo: { id: 999000 },
            chat: { id: Number(group.telegramId), title: group.title },
            message: { left_chat_member: { id: 999000, first_name: "Bot", is_bot: true } },
            state: { group, groupSettings: updated },
            reply: jest.fn(),
        };
        await handleMemberLeave(botLeaveCtx);
        expect(botLeaveCtx.reply).not.toHaveBeenCalled();

        // Goodbye fires for human departure
        const humanLeaveCtx = {
            botInfo: { id: 999000 },
            chat: { id: Number(group.telegramId), title: group.title },
            message: { left_chat_member: { id: 8002, first_name: "Bob", is_bot: false } },
            state: { group, groupSettings: updated },
            reply: jest.fn().mockResolvedValue({ message_id: 102 }),
        };
        await handleMemberLeave(humanLeaveCtx);
        expect(humanLeaveCtx.reply).toHaveBeenCalledTimes(1);
    });

    test("3. Activity batching, aggregation, and paginated top members", async () => {
        await activityService.recordMessageActivity(group.id, user1.id);
        await activityService.recordMessageActivity(group.id, user1.id);
        await activityService.recordMessageActivity(group.id, user2.id);

        const stats = await activityService.getGroupStats(group.id);
        expect(stats.totalMessages).toBe(3);
        expect(stats.todayMessages).toBe(3);
        expect(stats.trackedMembers).toBe(2);

        const top = await activityService.getTopMembers(group.id, { page: 1, pageSize: 10 });
        expect(top.rows).toHaveLength(2);
        expect(top.rows[0].userId).toBe(user1.id);
        expect(top.rows[0].messageCount).toBe(2);
    });

    test("4 & 5. Quiz answer validation, duplicate callback prevention, and expiration", async () => {
        const started = await gameService.startQuizSession({
            groupId: group.id,
            hostUserId: user1.id,
            gameType: "QUIZ",
            expiresInSeconds: 60,
        });
        expect(started.conflict).toBe(false);

        const wrongIndex = (started.question.answerIndex + 1) % 4;
        const wrongRes = await gameService.answerQuizSession({
            sessionId: started.session.id,
            userId: user2.id,
            choiceIndex: wrongIndex,
        });
        expect(wrongRes.status).toBe("wrong");

        // Second attempt by same user is blocked
        const repeatRes = await gameService.answerQuizSession({
            sessionId: started.session.id,
            userId: user2.id,
            choiceIndex: started.question.answerIndex,
        });
        expect(repeatRes.status).toBe("already_attempted");

        // Correct answer by user1 wins and completes session
        const winRes = await gameService.answerQuizSession({
            sessionId: started.session.id,
            userId: user1.id,
            choiceIndex: started.question.answerIndex,
        });
        expect(winRes.status).toBe("correct");

        // Replaying completed game is rejected
        const replayRes = await gameService.answerQuizSession({
            sessionId: started.session.id,
            userId: user1.id,
            choiceIndex: started.question.answerIndex,
        });
        expect(replayRes.status).toBe("expired_or_completed");

        // Expired game session cleanup
        const expired = await gameSessionRepository.createSession({
            groupId: group.id,
            hostUserId: user1.id,
            gameType: "TRIVIA",
            state: {},
            expiresAt: new Date(Date.now() - 5000),
        });
        const expiredCount = await gameSessionRepository.expireOverdueSessions(new Date());
        expect(expiredCount).toBeGreaterThanOrEqual(1);
        expect(await gameSessionRepository.findActiveSessionById(expired.id)).toBeNull();
    });

    test("6. Tic-Tac-Toe turns, win/draw detection, and score updates", async () => {
        expect(
            gameService.checkTicTacToeWinner(["X", "X", "X", null, "O", "O", null, null, null])
        ).toBe("X");
        expect(
            gameService.checkTicTacToeWinner(["X", "O", "X", "X", "O", "O", "O", "X", "X"])
        ).toBe("DRAW");

        const ttt = await gameService.startTicTacToe({
            groupId: group.id,
            hostUserId: user1.id,
            hostTgId: 8001,
            hostName: "Alice",
        });

        // X plays cell 0
        const m1 = await gameService.handleTicTacToeMove({
            sessionId: ttt.session.id,
            playerDbId: user1.id,
            playerTgId: 8001,
            playerName: "Alice",
            cellIndex: 0,
        });
        expect(m1.status).toBe("continue");

        // X cannot play twice in a row
        const invalidTurn = await gameService.handleTicTacToeMove({
            sessionId: ttt.session.id,
            playerDbId: user1.id,
            playerTgId: 8001,
            playerName: "Alice",
            cellIndex: 1,
        });
        expect(invalidTurn.status).toBe("waiting_for_opponent");

        // Bob joins as O on cell 3
        await gameService.handleTicTacToeMove({
            sessionId: ttt.session.id,
            playerDbId: user2.id,
            playerTgId: 8002,
            playerName: "Bob",
            cellIndex: 3,
        });

        // X plays 1, O plays 4, X plays 2 -> X wins
        await gameService.handleTicTacToeMove({
            sessionId: ttt.session.id,
            playerDbId: user1.id,
            playerTgId: 8001,
            playerName: "Alice",
            cellIndex: 1,
        });
        await gameService.handleTicTacToeMove({
            sessionId: ttt.session.id,
            playerDbId: user2.id,
            playerTgId: 8002,
            playerName: "Bob",
            cellIndex: 4,
        });
        const winMove = await gameService.handleTicTacToeMove({
            sessionId: ttt.session.id,
            playerDbId: user1.id,
            playerTgId: 8001,
            playerName: "Alice",
            cellIndex: 2,
        });
        expect(winMove.status).toBe("win");
        expect(winMove.winner).toBe("X");

        const stats = await scoreService.getMyStats(group.id, user1.id);
        expect(stats.wins).toBeGreaterThanOrEqual(2);
    });

    test("7. Daily challenge enforcement & group leaderboard", async () => {
        const daily = await gameService.startQuizSession({
            groupId: group.id,
            hostUserId: user2.id,
            gameType: "DAILY",
        });

        const res = await gameService.answerQuizSession({
            sessionId: daily.session.id,
            userId: user2.id,
            choiceIndex: daily.question.answerIndex,
        });
        expect(res.status).toBe("correct");
        expect(await scoreService.hasCompletedDailyToday(group.id, user2.id)).toBe(true);

        const lb = await scoreService.getLeaderboard(group.id, { period: "all" });
        expect(lb.rows.length).toBeGreaterThanOrEqual(2);
    });

    test("8. Word chain, input validation, entertainment commands, and command discovery", async () => {
        const wc = await gameService.startWordChainSession({
            groupId: group.id,
            hostUserId: user1.id,
        });
        const needed = wc.seedWord.slice(-1);
        const validWord = `${needed}es${needed}`;

        const accepted = await gameService.handleTextGameMessage({
            groupId: group.id,
            userId: user1.id,
            text: validWord,
        });
        expect(accepted.type).toBe("WORDCHAIN_ACCEPTED");

        // Duplicate word rejected
        const dup = await gameService.handleTextGameMessage({
            groupId: group.id,
            userId: user2.id,
            text: validWord,
        });
        expect(dup.type).toBe("WORDCHAIN_DUPLICATE");

        // /choose validation
        expect(parseChooseOptions("").error).toBeDefined();
        expect(parseChooseOptions("OnlyOne").error).toBeDefined();
        expect(parseChooseOptions("a".repeat(305)).error).toBeDefined();
        expect(parseChooseOptions("Pizza | Burgers | Tacos").options).toHaveLength(3);

        // /roll, /8ball, /joke
        const reply = jest.fn().mockResolvedValue(true);
        await rollCommand.execute({ message: { text: "/roll 20" }, reply });
        expect(reply).toHaveBeenCalledTimes(1);

        await eightBallCommand.execute({ message: { text: "/8ball" }, reply });
        expect(reply.mock.calls[1][0]).toContain("Ask a question");

        await jokeCommand.execute({ reply });
        expect(reply).toHaveBeenCalledTimes(3);

        // Verify all Phase 7 & 8 commands are discovered
        const bot = createBot("123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
        for (const cmd of [
            "welcome",
            "goodbye",
            "activity",
            "groupstats",
            "topmembers",
            "members",
            "id",
            "info",
            "quiz",
            "trivia",
            "riddle",
            "math",
            "guess",
            "tictactoe",
            "wordchain",
            "truth",
            "dare",
            "leaderboard",
            "myscore",
            "dailychallenge",
            "joke",
            "fact",
            "quote",
            "ship",
            "roll",
            "flip",
            "8ball",
            "choose",
            "compliment",
            "roast",
        ]) {
            expect(bot.context.commands.has(cmd)).toBe(true);
        }
    });
});

