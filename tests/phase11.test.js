const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { execSync } = require("child_process");

const testDbPath = path.join(os.tmpdir(), `telegram-bot-p11-${Date.now()}.db`);
process.env.NODE_ENV = "test";
process.env.BOT_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
process.env.DATABASE_URL = `file:${testDbPath}`;

const { initDatabase, disconnectDatabase } = require("../src/config/database");
const metricsService = require("../src/services/metricsService");
const { getHealthStatus } = require("../src/services/healthService");
const { startHealthServer, stopHealthServer } = require("../src/services/healthServer");
const { runMonitoredJob } = require("../src/jobs/jobMonitor");
const errorMiddleware = require("../src/middlewares/errorMiddleware");
const { createBot } = require("../src/bot");

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let body = "";
            res.on("data", (chunk) => {
                body += chunk;
            });
            res.on("end", () => {
                resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
            });
        }).on("error", reject);
    });
}

describe("Phase 11: Logging & Monitoring", () => {
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

    beforeEach(() => {
        metricsService.resetMetrics();
    });

    test("metricsService tracks command usage, Telegram API errors, and DB errors", async () => {
        metricsService.recordCommandUsage("ping");
        metricsService.recordCommandUsage("ping");
        metricsService.recordCommandUsage("help");
        metricsService.recordDatabaseError();

        const tgErr = new Error("Forbidden: bot was kicked");
        tgErr.name = "TelegramError";
        tgErr.response = { error_code: 403 };

        await errorMiddleware(
            { chat: { id: 1 }, from: { id: 2 }, reply: jest.fn().mockResolvedValue(true) },
            async () => {
                throw tgErr;
            }
        );

        const snap = metricsService.getMetricsSnapshot();
        expect(snap.commandsExecutedTotal).toBe(3);
        expect(snap.topCommands[0]).toEqual({ command: "ping", count: 2 });
        expect(snap.errorsTotal).toBe(1);
        expect(snap.telegramApiErrorsTotal).toBe(1);
        expect(snap.databaseErrorsTotal).toBe(1);
    });

    test("runMonitoredJob tracks job health and marks degraded after 3 consecutive failures", async () => {
        await runMonitoredJob("testJob", async () => "ok");
        let health = await getHealthStatus();
        expect(health.status).toBe("ok");
        expect(health.jobs.testJob.status).toBe("healthy");

        for (let i = 0; i < 3; i += 1) {
            await runMonitoredJob("testJob", async () => {
                throw new Error("Simulated job crash");
            });
        }

        health = await getHealthStatus();
        expect(health.status).toBe("degraded");
        expect(health.jobs.testJob.status).toBe("failing");
        expect(health.metrics.jobFailuresTotal).toBe(3);
    });

    test("healthServer serves GET /health and shuts down cleanly", async () => {
        const server = startHealthServer({ host: "127.0.0.1", port: 0 });
        await new Promise((resolve) => server.once("listening", resolve));
        const { port } = server.address();

        try {
            const res = await fetchJson(`http://127.0.0.1:${port}/health`);
            expect(res.statusCode).toBe(200);
            expect(res.body.status).toBe("ok");
            expect(res.body.database.status).toBe("up");
        } finally {
            await stopHealthServer(server);
        }
    });

    test("discovers /health command and /help outputs all commands within Telegram limits", async () => {
        const bot = createBot("123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
        expect(bot.context.commands.has("health")).toBe(true);

        const helpCmd = bot.context.commands.get("help");
        const reply = jest.fn().mockResolvedValue(true);
        await helpCmd.execute({
            commands: bot.context.commands,
            message: { text: "/help" },
            reply,
        });

        expect(reply.mock.calls.length).toBeGreaterThanOrEqual(1);
        const fullOutput = reply.mock.calls.map((c) => c[0]).join("\n");
        for (const call of reply.mock.calls) {
            expect(call[0].length).toBeLessThanOrEqual(4096);
        }
        for (const cmdName of bot.context.commands.keys()) {
            expect(fullOutput).toContain(`/${cmdName}`);
        }
    });
});

