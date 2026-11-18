const { loadEnv, parseBoolean, parseInteger } = require("../src/config/env");

describe("Phase 1: Environment Configuration", () => {
    test("parseBoolean handles truthy, falsy, and empty values", () => {
        expect(parseBoolean("true")).toBe(true);
        expect(parseBoolean("1")).toBe(true);
        expect(parseBoolean("yes")).toBe(true);
        expect(parseBoolean("false")).toBe(false);
        expect(parseBoolean(undefined, true)).toBe(true);
        expect(parseBoolean("", false)).toBe(false);
    });

    test("parseInteger parses valid integers and falls back on invalid input", () => {
        expect(parseInteger("3000", 8080)).toBe(3000);
        expect(parseInteger("invalid", 8080)).toBe(8080);
        expect(parseInteger(undefined, 8080)).toBe(8080);
    });

    test("loadEnv throws when BOT_TOKEN is missing or placeholder", () => {
        expect(() => loadEnv({ NODE_ENV: "test" })).toThrow(/BOT_TOKEN/);
        expect(() =>
            loadEnv({ BOT_TOKEN: "your_telegram_bot_token_here" })
        ).toThrow(/BOT_TOKEN/);
    });

    test("loadEnv throws when WEBHOOK_ENABLED is true without WEBHOOK_DOMAIN", () => {
        expect(() =>
            loadEnv({
                BOT_TOKEN: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
                WEBHOOK_ENABLED: "true",
            })
        ).toThrow(/WEBHOOK_DOMAIN/);
    });

    test("loadEnv returns frozen config object with defaults", () => {
        const config = loadEnv({
            NODE_ENV: "test",
            BOT_TOKEN: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
            BOT_USERNAME: "@my_test_bot",
        });

        expect(Object.isFrozen(config)).toBe(true);
        expect(config.isTest).toBe(true);
        expect(config.botUsername).toBe("my_test_bot");
        expect(config.logLevel).toBe("info");
        expect(config.webhook.enabled).toBe(false);
        expect(config.webhook.port).toBe(3000);
    });
});

describe("Phase 1: Logger and Bot Initialization", () => {
    beforeAll(() => {
        process.env.NODE_ENV = "test";
        process.env.BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
    });

    test("createChildLogger returns a pino child logger", () => {
        const { logger, createChildLogger } = require("../src/utils/logger");
        const child = createChildLogger("test-module");

        expect(typeof logger.info).toBe("function");
        expect(typeof child.info).toBe("function");
        expect(typeof child.error).toBe("function");
    });

    test("createBot initializes a Telegraf instance without launching", () => {
        const { createBot } = require("../src/bot");
        const bot = createBot("123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");

        expect(bot).toBeDefined();
        expect(typeof bot.launch).toBe("function");
        expect(typeof bot.handleUpdate).toBe("function");
    });
});

