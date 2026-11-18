const gameSessionRepository = require("../database/repositories/gameSessionRepository");
const scoreService = require("./scoreService");
const { getDateKey } = require("./activityService");
const quizQuestions = require("../data/quizQuestions");
const riddles = require("../data/riddles");

const WIN_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
];

function normalizeAnswer(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
        .replace(/^(a|an|the)\s+/i, "")
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
}

function checkTicTacToeWinner(board) {
    for (const [a, b, c] of WIN_LINES) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    if (board.every((cell) => cell !== null)) {
        return "DRAW";
    }
    return null;
}

function generateMathProblem(difficulty = "easy") {
    const level = ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "easy";
    let a;
    let b;
    let op;

    if (level === "easy") {
        a = Math.floor(Math.random() * 20) + 1;
        b = Math.floor(Math.random() * 20) + 1;
        op = Math.random() < 0.5 ? "+" : "-";
    } else if (level === "medium") {
        a = Math.floor(Math.random() * 40) + 10;
        b = Math.floor(Math.random() * 12) + 2;
        op = ["+", "-", "*"][Math.floor(Math.random() * 3)];
    } else {
        a = Math.floor(Math.random() * 90) + 15;
        b = Math.floor(Math.random() * 25) + 5;
        op = ["+", "-", "*"][Math.floor(Math.random() * 3)];
    }

    const answer = op === "+" ? a + b : op === "-" ? a - b : a * b;
    const points = level === "easy" ? 10 : level === "medium" ? 15 : 25;

    return {
        prompt: `${a} ${op} ${b}`,
        answer: String(answer),
        difficulty: level,
        points,
    };
}

/**
 * Start a Quiz, Trivia, or Daily Challenge multiple-choice session.
 */
async function startQuizSession({
    groupId,
    hostUserId,
    gameType = "QUIZ",
    difficulty = null,
    expiresInSeconds = 60,
}) {
    const existing = await gameSessionRepository.findActiveSession(groupId, [
        "QUIZ",
        "TRIVIA",
        "DAILY",
    ]);
    if (existing) {
        return { conflict: true, existing };
    }

    const pool = difficulty
        ? quizQuestions.filter((q) => q.difficulty === difficulty)
        : quizQuestions;
    const candidates = pool.length > 0 ? pool : quizQuestions;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];

    const points =
        gameType === "DAILY"
            ? 25
            : picked.difficulty === "hard"
              ? 20
              : picked.difficulty === "medium"
                ? 15
                : 10;

    const session = await gameSessionRepository.createSession({
        groupId,
        hostUserId,
        gameType,
        state: {
            question: picked.question,
            options: picked.options,
            answerIndex: picked.answerIndex,
            difficulty: picked.difficulty,
            points,
            dailyKey: gameType === "DAILY" ? getDateKey() : null,
            attemptedUserIds: [],
        },
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    });

    return { conflict: false, session, question: picked, points };
}

/**
 * Process a quiz/trivia/daily inline button answer.
 */
async function answerQuizSession({ sessionId, userId, choiceIndex }) {
    const session = await gameSessionRepository.findActiveSessionById(sessionId);
    if (!session) {
        return { status: "expired_or_completed" };
    }

    const state = session.state;
    if (state.dailyKey && (await scoreService.hasCompletedDailyToday(session.groupId, userId))) {
        return { status: "daily_already_done" };
    }

    if (state.attemptedUserIds.includes(userId)) {
        return { status: "already_attempted" };
    }

    const isCorrect = Number(choiceIndex) === Number(state.answerIndex);
    if (!isCorrect) {
        state.attemptedUserIds.push(userId);
        await gameSessionRepository.updateSessionState(session.id, state);
        return { status: "wrong" };
    }

    const wonLock = await gameSessionRepository.completeSessionIfActive(session.id, "COMPLETED");
    if (!wonLock) {
        return { status: "expired_or_completed" };
    }

    await scoreService.awardWin({
        groupId: session.groupId,
        userId,
        game: session.gameType.toLowerCase(),
        points: state.points || 10,
        dailyKey: state.dailyKey || null,
    });

    return {
        status: "correct",
        points: state.points || 10,
        correctOption: state.options[state.answerIndex],
        question: state.question,
    };
}

/**
 * Start a Riddle, Math, Number Guess, or Word Chain text-based game.
 */
async function startRiddleSession({ groupId, hostUserId, expiresInSeconds = 90 }) {
    const existing = await gameSessionRepository.findActiveSession(groupId, [
        "RIDDLE",
        "MATH",
        "GUESS",
        "WORDCHAIN",
    ]);
    if (existing) {
        return { conflict: true, existing };
    }

    const picked = riddles[Math.floor(Math.random() * riddles.length)];
    const accepted = [picked.answer, ...(picked.aliases || [])].map(normalizeAnswer);

    const session = await gameSessionRepository.createSession({
        groupId,
        hostUserId,
        gameType: "RIDDLE",
        state: {
            question: picked.question,
            displayAnswer: picked.answer,
            acceptedAnswers: accepted,
            points: 15,
        },
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    });

    return { conflict: false, session, riddle: picked };
}

async function startMathSession({
    groupId,
    hostUserId,
    difficulty = "easy",
    expiresInSeconds = 45,
}) {
    const existing = await gameSessionRepository.findActiveSession(groupId, [
        "RIDDLE",
        "MATH",
        "GUESS",
        "WORDCHAIN",
    ]);
    if (existing) {
        return { conflict: true, existing };
    }

    const problem = generateMathProblem(difficulty);
    const session = await gameSessionRepository.createSession({
        groupId,
        hostUserId,
        gameType: "MATH",
        state: {
            prompt: problem.prompt,
            answer: problem.answer,
            difficulty: problem.difficulty,
            points: problem.points,
        },
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    });

    return { conflict: false, session, problem };
}

async function startGuessSession({
    groupId,
    hostUserId,
    maxNumber = 100,
    expiresInSeconds = 120,
}) {
    const existing = await gameSessionRepository.findActiveSession(groupId, [
        "RIDDLE",
        "MATH",
        "GUESS",
        "WORDCHAIN",
    ]);
    if (existing) {
        return { conflict: true, existing };
    }

    const secret = Math.floor(Math.random() * maxNumber) + 1;
    const session = await gameSessionRepository.createSession({
        groupId,
        hostUserId,
        gameType: "GUESS",
        state: {
            secret,
            maxNumber,
            attempts: 0,
            points: 15,
        },
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    });

    return { conflict: false, session, maxNumber };
}

async function startWordChainSession({ groupId, hostUserId, expiresInSeconds = 180 }) {
    const existing = await gameSessionRepository.findActiveSession(groupId, [
        "RIDDLE",
        "MATH",
        "GUESS",
        "WORDCHAIN",
    ]);
    if (existing) {
        return { conflict: true, existing };
    }

    const seeds = ["planet", "rocket", "silver", "forest", "stream", "anchor"];
    const seedWord = seeds[Math.floor(Math.random() * seeds.length)];

    const session = await gameSessionRepository.createSession({
        groupId,
        hostUserId,
        gameType: "WORDCHAIN",
        state: {
            lastWord: seedWord,
            usedWords: [seedWord],
            lastUserId: null,
        },
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    });

    return { conflict: false, session, seedWord };
}

/**
 * Inspect an incoming group text message against any active text-based game session.
 * Returns null if no active text game matched or input isn't a valid attempt.
 */
async function handleTextGameMessage({ groupId, userId, text }) {
    const session = await gameSessionRepository.findActiveSession(groupId, [
        "RIDDLE",
        "MATH",
        "GUESS",
        "WORDCHAIN",
    ]);
    if (!session) {
        return null;
    }

    const state = session.state;

    if (session.gameType === "RIDDLE") {
        const normalized = normalizeAnswer(text);
        if (!normalized || !state.acceptedAnswers.includes(normalized)) {
            return null;
        }
        const wonLock = await gameSessionRepository.completeSessionIfActive(session.id);
        if (!wonLock) return null;

        await scoreService.awardWin({
            groupId,
            userId,
            game: "riddle",
            points: state.points || 15,
        });
        return {
            type: "RIDDLE_WON",
            answer: state.displayAnswer,
            points: state.points || 15,
        };
    }

    if (session.gameType === "MATH") {
        const trimmed = String(text || "").trim();
        if (!/^-?\d+$/.test(trimmed)) {
            return null;
        }
        if (trimmed !== state.answer) {
            return null;
        }
        const wonLock = await gameSessionRepository.completeSessionIfActive(session.id);
        if (!wonLock) return null;

        await scoreService.awardWin({
            groupId,
            userId,
            game: "math",
            points: state.points || 10,
        });
        return {
            type: "MATH_WON",
            answer: state.answer,
            points: state.points || 10,
        };
    }

    if (session.gameType === "GUESS") {
        const trimmed = String(text || "").trim();
        if (!/^\d+$/.test(trimmed)) {
            return null;
        }
        const guess = Number.parseInt(trimmed, 10);
        if (guess < 1 || guess > state.maxNumber) {
            return null;
        }

        state.attempts += 1;
        if (guess === state.secret) {
            const wonLock = await gameSessionRepository.completeSessionIfActive(session.id);
            if (!wonLock) return null;

            await scoreService.awardWin({
                groupId,
                userId,
                game: "guess",
                points: state.points || 15,
            });
            return {
                type: "GUESS_WON",
                secret: state.secret,
                attempts: state.attempts,
                points: state.points || 15,
            };
        }

        await gameSessionRepository.updateSessionState(session.id, state);
        return {
            type: "GUESS_HINT",
            hint: guess < state.secret ? "higher" : "lower",
            attempts: state.attempts,
        };
    }

    if (session.gameType === "WORDCHAIN") {
        const word = String(text || "").trim().toLowerCase();
        if (!/^[a-z]{2,30}$/.test(word)) {
            return null;
        }
        if (state.lastUserId === userId) {
            return { type: "WORDCHAIN_SAME_USER" };
        }
        const requiredLetter = state.lastWord.slice(-1);
        if (!word.startsWith(requiredLetter)) {
            return {
                type: "WORDCHAIN_WRONG_LETTER",
                requiredLetter,
            };
        }
        if (state.usedWords.includes(word)) {
            return { type: "WORDCHAIN_DUPLICATE", word };
        }

        state.lastWord = word;
        state.usedWords.push(word);
        state.lastUserId = userId;
        await gameSessionRepository.updateSessionState(session.id, state);
        await scoreService.awardWin({
            groupId,
            userId,
            game: "wordchain",
            points: 5,
        });

        return {
            type: "WORDCHAIN_ACCEPTED",
            word,
            nextLetter: word.slice(-1),
            chainLength: state.usedWords.length,
        };
    }

    return null;
}

/**
 * Start a 2-player Tic-Tac-Toe session.
 */
async function startTicTacToe({ groupId, hostUserId, hostTgId, hostName, expiresInSeconds = 300 }) {
    const existing = await gameSessionRepository.findActiveSession(groupId, "TICTACTOE");
    if (existing) {
        return { conflict: true, existing };
    }

    const state = {
        board: Array(9).fill(null),
        turn: "X",
        playerX: { dbId: hostUserId, tgId: String(hostTgId), name: hostName },
        playerO: null,
    };

    const session = await gameSessionRepository.createSession({
        groupId,
        hostUserId,
        gameType: "TICTACTOE",
        state,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    });

    return { conflict: false, session, state };
}

/**
 * Process a Tic-Tac-Toe inline button move.
 */
async function handleTicTacToeMove({ sessionId, playerDbId, playerTgId, playerName, cellIndex }) {
    const session = await gameSessionRepository.findActiveSessionById(sessionId);
    if (!session) {
        return { status: "expired_or_completed" };
    }

    const state = session.state;
    const tgIdStr = String(playerTgId);

    // Join as Player O if seat is open and clicker is not Player X
    if (!state.playerO && tgIdStr !== state.playerX.tgId && state.turn === "O") {
        state.playerO = { dbId: playerDbId, tgId: tgIdStr, name: playerName };
    }

    const activePlayer = state.turn === "X" ? state.playerX : state.playerO;
    if (state.turn === "O" && !state.playerO) {
        if (tgIdStr === state.playerX.tgId) {
            return { status: "waiting_for_opponent" };
        }
        state.playerO = { dbId: playerDbId, tgId: tgIdStr, name: playerName };
    } else if (!activePlayer || activePlayer.tgId !== tgIdStr) {
        return { status: "not_your_turn" };
    }

    if (cellIndex < 0 || cellIndex > 8 || state.board[cellIndex] !== null) {
        return { status: "invalid_cell" };
    }

    state.board[cellIndex] = state.turn;
    const outcome = checkTicTacToeWinner(state.board);

    if (outcome === "X" || outcome === "O") {
        const wonLock = await gameSessionRepository.completeSessionIfActive(session.id);
        if (!wonLock) {
            return { status: "expired_or_completed" };
        }

        const winner = outcome === "X" ? state.playerX : state.playerO;
        const loser = outcome === "X" ? state.playerO : state.playerX;

        await scoreService.awardWin({
            groupId: session.groupId,
            userId: winner.dbId,
            game: "tictactoe",
            points: 20,
        });
        if (loser?.dbId) {
            await scoreService.recordLoss({
                groupId: session.groupId,
                userId: loser.dbId,
                game: "tictactoe",
            });
        }

        return { status: "win", winner: outcome, state };
    }

    if (outcome === "DRAW") {
        const wonLock = await gameSessionRepository.completeSessionIfActive(session.id);
        if (!wonLock) {
            return { status: "expired_or_completed" };
        }
        return { status: "draw", state };
    }

    state.turn = state.turn === "X" ? "O" : "X";
    await gameSessionRepository.updateSessionState(session.id, state);
    return { status: "continue", state };
}

module.exports = {
    normalizeAnswer,
    checkTicTacToeWinner,
    generateMathProblem,
    startQuizSession,
    answerQuizSession,
    startRiddleSession,
    startMathSession,
    startGuessSession,
    startWordChainSession,
    handleTextGameMessage,
    startTicTacToe,
    handleTicTacToeMove,
};

