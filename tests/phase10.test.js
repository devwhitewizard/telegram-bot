process.env.NODE_ENV = "test";
process.env.BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";

jest.mock("axios", () => ({
    request: jest.fn(),
}));

const axios = require("axios");
const { loadEnv } = require("../src/config/env");
const { HttpClientError, sanitizeUrlForLog, request } = require("../src/services/httpClient");
const weatherService = require("../src/services/weatherService");
const aiService = require("../src/services/aiService");
const githubService = require("../src/services/githubService");
const npmService = require("../src/services/npmService");
const newsService = require("../src/services/newsService");
const translationService = require("../src/services/translationService");
const currencyService = require("../src/services/currencyService");
const urlService = require("../src/services/urlService");
const qrService = require("../src/services/qrService");
const { createCooldownMiddleware } = require("../src/middlewares/cooldownMiddleware");
const { createBot } = require("../src/bot");

const weatherCmd = require("../src/commands/integrations/weather");
const qrCmd = require("../src/commands/integrations/qr");

describe("Phase 10: API Integrations & External Services", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("environment configuration loads optional API settings without crashing", () => {
        const cfg = loadEnv({
            NODE_ENV: "test",
            BOT_TOKEN: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
            AI_PROVIDER: "openrouter",
            AI_MODEL: "meta-llama/llama-3.1-8b-instruct",
            HTTP_TIMEOUT_MS: "5000",
        });

        expect(cfg.apis.httpTimeoutMs).toBe(5000);
        expect(cfg.apis.ai.provider).toBe("openrouter");
        expect(cfg.apis.ai.baseUrl).toBe("https://openrouter.ai/api/v1");
        expect(cfg.apis.ai.apiKey).toBe("");
        expect(cfg.apis.news.apiKey).toBe("");
    });

    test("httpClient handles timeout, network error, rate limit, and URL sanitization", async () => {
        expect(sanitizeUrlForLog("https://gnews.io/api/v4/search?q=node&apikey=SECRET")).toBe(
            "https://gnews.io/api/v4/search"
        );

        axios.request.mockRejectedValueOnce({ code: "ECONNABORTED", message: "timeout" });
        await expect(
            request({ method: "GET", url: "https://example.com" }, { retries: 0 })
        ).rejects.toMatchObject({ code: "TIMEOUT" });

        axios.request.mockRejectedValueOnce({ code: "ECONNRESET", message: "socket hang up" });
        await expect(
            request({ method: "GET", url: "https://example.com" }, { retries: 0 })
        ).rejects.toMatchObject({ code: "NETWORK_ERROR" });

        axios.request.mockRejectedValueOnce({ response: { status: 429 } });
        await expect(
            request({ method: "GET", url: "https://example.com" }, { retries: 0 })
        ).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });

        axios.request.mockClear();
        axios.request.mockRejectedValueOnce({ response: { status: 500 } });
        await expect(
            request({ method: "POST", url: "https://example.com" }, { retries: 2 })
        ).rejects.toBeInstanceOf(HttpClientError);
        // Non-idempotent POST must not retry
        expect(axios.request).toHaveBeenCalledTimes(1);
    });

    test("weatherService returns formatted weather and handles unknown locations", async () => {
        axios.request
            .mockResolvedValueOnce({
                data: {
                    results: [{ name: "London", admin1: "England", country: "United Kingdom", latitude: 51.5, longitude: -0.12 }],
                },
            })
            .mockResolvedValueOnce({
                data: {
                    current: { temperature_2m: 15, relative_humidity_2m: 72, wind_speed_10m: 12, weather_code: 2 },
                },
            });

        const res = await weatherService.getWeather("London");
        expect(res.found).toBe(true);
        expect(res.temperatureC).toBe(15);
        expect(res.temperatureF).toBe(59);
        expect(res.condition).toBe("Partly cloudy");

        axios.request.mockResolvedValueOnce({ data: { results: [] } });
        const missing = await weatherService.getWeather("NoSuchCityXYZ");
        expect(missing.found).toBe(false);
    });

    test("aiService handles missing key, prompt validation, and long Telegram responses", async () => {
        const missing = await aiService.askAi("Hello", { apiKey: "" });
        expect(missing.configured).toBe(false);

        await expect(
            aiService.askAi("", { apiKey: "fake-key", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", maxTokens: 100 })
        ).rejects.toThrow(/prompt/i);

        const longReply = "A".repeat(4500);
        axios.request.mockResolvedValueOnce({
            data: {
                model: "gpt-4o-mini",
                choices: [{ message: { content: longReply } }],
            },
        });

        const ok = await aiService.askAi("Write something long", {
            apiKey: "fake-key",
            baseUrl: "https://api.openai.com/v1",
            model: "gpt-4o-mini",
            maxTokens: 500,
        });
        expect(ok.configured).toBe(true);
        expect(ok.text.length).toBeLessThanOrEqual(4096);
        expect(ok.text).toContain("Truncated");
    });

    test("githubService looks up users and repositories", async () => {
        axios.request.mockResolvedValueOnce({
            data: {
                full_name: "telegraf/telegraf",
                description: "Modern Telegram Bot Framework",
                stargazers_count: 8000,
                forks_count: 1500,
                language: "TypeScript",
                html_url: "https://github.com/telegraf/telegraf",
            },
        });

        const repo = await githubService.lookupGithub("telegraf/telegraf");
        expect(repo.kind).toBe("repo");
        expect(repo.stars).toBe(8000);

        await expect(githubService.lookupGithub("bad/repo/path")).rejects.toThrow();
    });

    test("npmService retrieves package info and handles missing packages", async () => {
        axios.request
            .mockResolvedValueOnce({
                data: {
                    name: "telegraf",
                    "dist-tags": { latest: "4.16.3" },
                    description: "Telegram Bot API",
                    author: { name: "Telegraf" },
                },
            })
            .mockResolvedValueOnce({ data: { downloads: 120000 } });

        const pkg = await npmService.lookupNpmPackage("telegraf");
        expect(pkg.found).toBe(true);
        expect(pkg.version).toBe("4.16.3");
        expect(pkg.weeklyDownloads).toBe(120000);

        await expect(npmService.lookupNpmPackage("invalid package!")).rejects.toThrow();
    });

    test("newsService handles missing API key and returns limited articles", async () => {
        const missing = await newsService.searchNews("nodejs", { provider: "gnews", apiKey: "" });
        expect(missing.configured).toBe(false);

        axios.request.mockResolvedValueOnce({
            data: {
                articles: [
                    { title: "Node 22 Released", description: "Fast JS", source: { name: "Tech" }, url: "https://example.com/1" },
                ],
            },
        });

        const ok = await newsService.searchNews("nodejs", { provider: "gnews", apiKey: "fake-news-key" });
        expect(ok.configured).toBe(true);
        expect(ok.articles).toHaveLength(1);
    });

    test("translationService translates text and rejects unsupported/failed responses", async () => {
        axios.request.mockResolvedValueOnce({
            data: {
                responseStatus: 200,
                responseData: { translatedText: "Hola mundo" },
            },
        });

        const ok = await translationService.translateText(
            { text: "Hello world", targetLang: "es" },
            { provider: "mymemory" }
        );
        expect(ok.translatedText).toBe("Hola mundo");

        await expect(
            translationService.translateText({ text: "Hi", targetLang: "invalid!" })
        ).rejects.toThrow(/language/i);
    });

    test("currencyService converts valid currencies and validates amounts", async () => {
        axios.request.mockResolvedValueOnce({
            data: { date: "2026-11-18", rates: { EUR: 92.5 } },
        });

        const res = await currencyService.convertCurrency(100, "USD", "EUR");
        expect(res.converted).toBe(92.5);
        expect(res.date).toBe("2026-11-18");

        await expect(currencyService.convertCurrency(-5, "USD", "EUR")).rejects.toThrow();
    });

    test("urlService validates public HTTP/HTTPS URLs and blocks internal/unsafe schemes", async () => {
        expect(() => urlService.validatePublicHttpUrl("javascript:alert(1)")).toThrow();
        expect(() => urlService.validatePublicHttpUrl("http://localhost:3000")).toThrow();
        expect(() => urlService.validatePublicHttpUrl("http://127.0.0.1/admin")).toThrow();
        expect(() => urlService.validatePublicHttpUrl("http://192.168.1.1")).toThrow();
        expect(() => urlService.validatePublicHttpUrl("https://user:pass@example.com")).toThrow();

        axios.request.mockResolvedValueOnce({
            data: { shorturl: "https://is.gd/abc123" },
        });
        const shortened = await urlService.shortenUrl("https://nodejs.org/en");
        expect(shortened.shortUrl).toBe("https://is.gd/abc123");
    });

    test("qrService generates a valid PNG buffer locally", async () => {
        const buf = await qrService.generateQrPng("https://nodejs.org");
        expect(Buffer.isBuffer(buf)).toBe(true);
        // PNG magic bytes: 89 50 4E 47
        expect(buf.slice(0, 4).toString("hex")).toBe("89504e47");

        await expect(qrService.generateQrPng("")).rejects.toThrow();
    });

    test("command integration, singleFlight concurrency lock, and command discovery", async () => {
        // Weather command integration
        axios.request
            .mockResolvedValueOnce({
                data: { results: [{ name: "Tokyo", country: "Japan", latitude: 35.6, longitude: 139.7 }] },
            })
            .mockResolvedValueOnce({
                data: { current: { temperature_2m: 20, relative_humidity_2m: 60, wind_speed_10m: 8, weather_code: 0 } },
            });

        const reply = jest.fn().mockResolvedValue(true);
        await weatherCmd.execute({ message: { text: "/weather Tokyo" }, reply });
        expect(reply.mock.calls[0][0]).toContain("Tokyo");

        // QR command integration
        const replyWithPhoto = jest.fn().mockResolvedValue(true);
        await qrCmd.execute({ message: { text: "/qr https://example.com" }, reply, replyWithPhoto });
        expect(replyWithPhoto).toHaveBeenCalledTimes(1);

        // Single-flight concurrent request guard
        const mw = createCooldownMiddleware(0, { singleFlight: true });
        let releaseFirst;
        const firstNext = () =>
            new Promise((resolve) => {
                releaseFirst = resolve;
            });
        const secondNext = jest.fn();
        const sfReply = jest.fn().mockResolvedValue(true);
        const ctx = { chat: { id: 1 }, from: { id: 2 }, message: { text: "/ai hi" }, reply: sfReply };

        const firstPromise = mw(ctx, firstNext);
        await mw(ctx, secondNext);
        expect(secondNext).not.toHaveBeenCalled();
        expect(sfReply).toHaveBeenCalled();
        releaseFirst();
        await firstPromise;

        // Command discovery
        const bot = createBot("123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
        for (const cmd of [
            "weather",
            "ai",
            "github",
            "npm",
            "news",
            "translate",
            "currency",
            "shorten",
            "qr",
        ]) {
            expect(bot.context.commands.has(cmd)).toBe(true);
        }
    });
});
