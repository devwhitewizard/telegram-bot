const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const testDbPath = path.join(os.tmpdir(), `telegram-bot-p9-${Date.now()}.db`);
process.env.NODE_ENV = "test";
process.env.BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
process.env.DATABASE_URL = `file:${testDbPath}`;

const { initDatabase, disconnectDatabase } = require("../src/config/database");
const groupRepository = require("../src/database/repositories/groupRepository");
const settingsService = require("../src/services/settingsService");
const { buildSettingsView } = require("../src/keyboards/settingsKeyboard");
const { ensureCallbackAdmin } = require("../src/handlers/settingsHandler");
const { buildCommandMiddlewares } = require("../src/commands");
const { createBot } = require("../src/bot");

describe("Phase 9: Configuration & Settings", () => {
    let group;

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
            telegramId: -1005556667771,
            title: "Settings Test Group",
            type: "supergroup",
        });
    }, 30000);

    afterAll(async () => {
        await disconnectDatabase();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    test("toggles features, cycles moderation values, and applies spam/flood presets", async () => {
        let settings = group.settings;

        settings = await settingsService.toggleSetting(group.id, settings, "gamesEnabled");
        expect(settings.gamesEnabled).toBe(false);

        settings = await settingsService.cycleSetting(group.id, settings, "maxWarnings");
        expect(settings.maxWarnings).toBe(5);

        settings = await settingsService.cycleSetting(group.id, settings, "warnAction");
        expect(settings.warnAction).toBe("KICK");

        settings = await settingsService.applyAntiSpamPreset(group.id, "high");
        expect(settings.antiSpamThreshold).toBe(2);
        expect(settings.antiSpamWindowSeconds).toBe(15);

        settings = await settingsService.applyAntiFloodPreset(group.id, "low");
        expect(settings.antiFloodMaxMessages).toBe(8);
    });

    test("persists and enforces per-command permissions and game/fun availability", async () => {
        let settings = await settingsService.setCommandPermission(
            group.id,
            group.settings,
            "joke",
            "disabled"
        );
        expect(settingsService.getCommandPermission(settings, "joke")).toBe("disabled");

        // Test command access middleware blocking disabled command
        const jokeMiddlewares = buildCommandMiddlewares({
            name: "joke",
            category: "fun",
            cooldown: 0,
        });
        const next = jest.fn();
        const reply = jest.fn().mockResolvedValue(true);

        await jokeMiddlewares[0](
            { state: { groupSettings: settings }, reply },
            next
        );
        expect(next).not.toHaveBeenCalled();
        expect(reply).toHaveBeenCalledWith("The /joke command is disabled in this group.");

        // Test gamesEnabled = false blocking games category
        const quizMiddlewares = buildCommandMiddlewares({
            name: "quiz",
            category: "games",
            cooldown: 0,
        });
        await quizMiddlewares[0](
            { state: { groupSettings: { ...settings, gamesEnabled: false } }, reply },
            next
        );
        expect(next).not.toHaveBeenCalled();
        expect(reply).toHaveBeenCalledWith("Games are currently disabled in this group.");
    });

    test("buildSettingsView renders inline keyboards for all submenus", () => {
        for (const menu of ["main", "mod", "prot", "welcome", "games", "perms"]) {
            const view = buildSettingsView(menu, group.settings, "Settings Group");
            expect(view.text).toContain("Settings Group");
            expect(view.extra.reply_markup.inline_keyboard.length).toBeGreaterThan(0);
        }
    });

    test("ensureCallbackAdmin blocks non-admins and allows admins", async () => {
        const nonAdminCtx = {
            chat: { id: -1001, type: "supergroup" },
            from: { id: 10 },
            answerCbQuery: jest.fn().mockResolvedValue(true),
            telegram: {
                getChatMember: jest.fn().mockResolvedValue({ status: "member" }),
            },
        };
        expect(await ensureCallbackAdmin(nonAdminCtx)).toBe(false);
        expect(nonAdminCtx.answerCbQuery).toHaveBeenCalled();

        const adminCtx = {
            chat: { id: -1001, type: "supergroup" },
            from: { id: 11 },
            answerCbQuery: jest.fn().mockResolvedValue(true),
            telegram: {
                getChatMember: jest.fn().mockResolvedValue({ status: "administrator" }),
            },
        };
        expect(await ensureCallbackAdmin(adminCtx)).toBe(true);
    });

    test("discovers all Phase 9 commands", () => {
        const bot = createBot("123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
        for (const cmd of ["settings", "cmdperm", "rules", "setrules", "groupinfo"]) {
            expect(bot.context.commands.has(cmd)).toBe(true);
        }
    });
});

