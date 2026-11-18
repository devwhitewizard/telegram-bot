const http = require("http");
const { getHealthStatus } = require("./healthService");
const { createChildLogger } = require("../utils/logger");

const serverLogger = createChildLogger("healthServer");

/**
 * Start a lightweight HTTP server exposing GET /health for VPS monitoring (UptimeRobot, systemd, Docker, etc.).
 * Binds to 127.0.0.1 by default so it is not exposed publicly unless configured.
 */
function startHealthServer({ host = "127.0.0.1", port = 3001 } = {}) {
    const server = http.createServer(async (req, res) => {
        if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
            try {
                const report = await getHealthStatus();
                const code = report.status === "ok" ? 200 : 503;
                res.writeHead(code, { "Content-Type": "application/json" });
                res.end(JSON.stringify(report));
            } catch (err) {
                serverLogger.error({ err }, "Health endpoint failed");
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ status: "error" }));
            }
            return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
    });

    server.listen(port, host, () => {
        serverLogger.info({ host, port }, "Health check HTTP server listening");
    });

    return server;
}

function stopHealthServer(server) {
    if (!server) {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        server.close(() => resolve());
    });
}

module.exports = {
    startHealthServer,
    stopHealthServer,
};

