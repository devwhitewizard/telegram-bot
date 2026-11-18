const { Markup } = require("telegraf");
const gameService = require("../services/gameService");
const activityService = require("../services/activityService");
const scoreService = require("../services/scoreService");
const { escapeHtml } = require("../utils/escapeMarkdown");

function buildTicTacToeKeyboard(sessionId, board) {
    const rows = [];
    for (let r = 0; r < 3; r += 1) {
        const row = [];
        for (let c = 0; c < 3; c += 1) {
            const idx = r * 3 + c;
            const cell = board[idx];
            const label = cell === "X" ? "❌" : cell === "O" ? "⭕" : "⬜";
            row.push(Markup.button.callback(label, `ttt:${sessionId}:${idx}`));
        }
        rows.push(row);
    }
    return Markup.inlineKeyboard(rows);
}

function registerGameHandlers(bot) {
    // Quiz / Trivia / Daily Challenge inline answer handler
    bot.action(/^quiz:(\d+):(\d+)$/, async (ctx) => {
        const sessionId = Number.parseInt(ctx.match[1], 10);
        const choiceIndex = Number.parseInt(ctx.match[2], 10);
        const user = ctx.state.user;

        if (!user) {
            await ctx.answerCbQuery("User context unavailable.");
            return;
        }

        const result = await gameService.answerQuizSession({
            sessionId,
            userId: user.id,
            choiceIndex,
        });

        if (result.status === "expired_or_completed") {
            await ctx.answerCbQuery("This game has already ended or expired.", {
                show_alert: true,
            });
            return;
        }
        if (result.status === "daily_already_done") {
            await ctx.answerCbQuery("You already completed today's daily challenge!", {
                show_alert: true,
            });
            return;
        }
        if (result.status === "already_attempted") {
            await ctx.answerCbQuery("You already tried answering this question!", {
                show_alert: true,
            });
            return;
        }
        if (result.status === "wrong") {
            await ctx.answerCbQuery("❌ Incorrect! Wait for someone else or try the next round.", {
                show_alert: true,
            });
            return;
        }

        await ctx.answerCbQuery(`✅ Correct! +${result.points} points!`);
        const winnerName = escapeHtml(ctx.from.first_name || "Player");
        try {
            await ctx.editMessageText(
                `🏆 <b>${winnerName}</b> answered correctly and earned <b>+${result.points} pts</b>!\n\n` +
                    `Question: ${escapeHtml(result.question)}\n` +
                    `Answer: <b>${escapeHtml(result.correctOption)}</b>`,
                { parse_mode: "HTML" }
            );
        } catch {
            // Ignore edit failure if message was deleted
        }
    });

    // Tic-Tac-Toe inline move handler
    bot.action(/^ttt:(\d+):(\d)$/, async (ctx) => {
        const sessionId = Number.parseInt(ctx.match[1], 10);
        const cellIndex = Number.parseInt(ctx.match[2], 10);
        const user = ctx.state.user;

        if (!user) {
            await ctx.answerCbQuery("User context unavailable.");
            return;
        }

        const result = await gameService.handleTicTacToeMove({
            sessionId,
            playerDbId: user.id,
            playerTgId: ctx.from.id,
            playerName: ctx.from.first_name || "Player",
            cellIndex,
        });

        if (result.status === "expired_or_completed") {
            await ctx.answerCbQuery("This Tic-Tac-Toe game has ended.", { show_alert: true });
            return;
        }
        if (result.status === "waiting_for_opponent") {
            await ctx.answerCbQuery("Waiting for another player to join as O!", {
                show_alert: true,
            });
            return;
        }
        if (result.status === "not_your_turn") {
            await ctx.answerCbQuery("It is not your turn!", { show_alert: true });
            return;
        }
        if (result.status === "invalid_cell") {
            await ctx.answerCbQuery("That cell is already taken.");
            return;
        }

        await ctx.answerCbQuery();
        const s = result.state;
        const xName = escapeHtml(s.playerX?.name || "Player X");
        const oName = escapeHtml(s.playerO?.name || "Waiting...");

        if (result.status === "win") {
            const winnerName = result.winner === "X" ? xName : oName;
            await ctx.editMessageText(
                `🎮 <b>Tic-Tac-Toe</b>\n❌ ${xName} vs ⭕ ${oName}\n\n🏆 <b>${winnerName}</b> (${result.winner}) wins! (+20 pts)`,
                {
                    parse_mode: "HTML",
                    ...buildTicTacToeKeyboard(sessionId, s.board),
                }
            );
            return;
        }

        if (result.status === "draw") {
            await ctx.editMessageText(
                `🎮 <b>Tic-Tac-Toe</b>\n❌ ${xName} vs ⭕ ${oName}\n\n🤝 It's a draw!`,
                {
                    parse_mode: "HTML",
                    ...buildTicTacToeKeyboard(sessionId, s.board),
                }
            );
            return;
        }

        const nextName = s.turn === "X" ? xName : oName;
        await ctx.editMessageText(
            `🎮 <b>Tic-Tac-Toe</b>\n❌ ${xName} vs ⭕ ${oName}\n\nTurn: <b>${s.turn}</b> (${nextName})`,
            {
                parse_mode: "HTML",
                ...buildTicTacToeKeyboard(sessionId, s.board),
            }
        );
    });

    // Top members pagination callback
    bot.action(/^topmembers:(\d+)$/, async (ctx) => {
        const group = ctx.state.group;
        if (!group) {
            await ctx.answerCbQuery();
            return;
        }
        const page = Number.parseInt(ctx.match[1], 10);
        const { rows, totalPages } = await activityService.getTopMembers(group.id, {
            page,
            pageSize: 10,
        });

        if (rows.length === 0) {
            await ctx.answerCbQuery("No more entries.");
            return;
        }

        const lines = rows.map((row, idx) => {
            const rank = (page - 1) * 10 + idx + 1;
            const name = escapeHtml(row.user?.firstName || "User");
            return `${rank}. <b>${name}</b> — ${row.messageCount} msgs`;
        });

        const navButtons = [];
        if (page > 1) navButtons.push(Markup.button.callback("⬅️ Prev", `topmembers:${page - 1}`));
        if (page < totalPages) {
            navButtons.push(Markup.button.callback("Next ➡️", `topmembers:${page + 1}`));
        }

        await ctx.answerCbQuery();
        await ctx.editMessageText(
            `📊 <b>Top Active Members</b> (Page ${page}/${totalPages})\n\n${lines.join("\n")}`,
            {
                parse_mode: "HTML",
                ...(navButtons.length > 0 ? Markup.inlineKeyboard([navButtons]) : {}),
            }
        );
    });

    // Leaderboard pagination/period callback
    bot.action(/^lb:(all|daily|weekly):(\d+)$/, async (ctx) => {
        const group = ctx.state.group;
        if (!group) {
            await ctx.answerCbQuery();
            return;
        }
        const period = ctx.match[1];
        const page = Number.parseInt(ctx.match[2], 10);
        const { rows } = await scoreService.getLeaderboard(group.id, {
            period,
            page,
            pageSize: 10,
        });

        await ctx.answerCbQuery();
        if (rows.length === 0) {
            await ctx.editMessageText(`🏆 No scores recorded yet for <b>${period}</b>.`, {
                parse_mode: "HTML",
            });
            return;
        }

        const lines = rows.map((row, idx) => {
            const rank = (page - 1) * 10 + idx + 1;
            const name = escapeHtml(row.user?.firstName || "Player");
            return `${rank}. <b>${name}</b> — ${row.score} pts`;
        });

        await ctx.editMessageText(
            `🏆 <b>Leaderboard (${period.toUpperCase()})</b>\n\n${lines.join("\n")}`,
            { parse_mode: "HTML" }
        );
    });

    // Text-based game answer listener (Riddle, Math, Guess, Word Chain)
    bot.on("text", async (ctx, next) => {
        if (
            ctx.chat &&
            (ctx.chat.type === "group" || ctx.chat.type === "supergroup") &&
            ctx.state.group &&
            ctx.state.user &&
            ctx.message?.text &&
            !ctx.message.text.startsWith("/")
        ) {
            const outcome = await gameService.handleTextGameMessage({
                groupId: ctx.state.group.id,
                userId: ctx.state.user.id,
                text: ctx.message.text,
            });

            if (outcome) {
                const name = escapeHtml(ctx.from.first_name || "Player");
                if (outcome.type === "RIDDLE_WON") {
                    await ctx.reply(
                        `🎉 <b>${name}</b> solved the riddle! Answer: <b>${escapeHtml(
                            outcome.answer
                        )}</b> (+${outcome.points} pts)`,
                        { parse_mode: "HTML" }
                    );
                } else if (outcome.type === "MATH_WON") {
                    await ctx.reply(
                        `🧮 <b>${name}</b> solved it! Answer: <b>${outcome.answer}</b> (+${outcome.points} pts)`,
                        { parse_mode: "HTML" }
                    );
                } else if (outcome.type === "GUESS_WON") {
                    await ctx.reply(
                        `🎯 <b>${name}</b> guessed the secret number <b>${outcome.secret}</b> in ${outcome.attempts} attempt(s)! (+${outcome.points} pts)`,
                        { parse_mode: "HTML" }
                    );
                } else if (outcome.type === "GUESS_HINT") {
                    await ctx.reply(`Go <b>${outcome.hint}</b>! (Attempt #${outcome.attempts})`, {
                        parse_mode: "HTML",
                    });
                } else if (outcome.type === "WORDCHAIN_ACCEPTED") {
                    await ctx.reply(
                        `✅ <b>${escapeHtml(outcome.word)}</b> accepted! (+5 pts)\nNext word must start with <b>${outcome.nextLetter.toUpperCase()}</b> (Chain: ${outcome.chainLength})`,
                        { parse_mode: "HTML" }
                    );
                }
            }
        }

        return next();
    });
}

module.exports = {
    buildTicTacToeKeyboard,
    registerGameHandlers,
};

