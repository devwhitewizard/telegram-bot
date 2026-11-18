const { env } = require("./env");

/**
 * Central bot configuration defaults.
 * Non-secret behavioral settings belong here rather than in .env.
 */
const botConfig = Object.freeze({
    name: "Telegram Group Management & Entertainment Bot",
    version: "1.0.0",
    environment: env.nodeEnv,

    telegraf: Object.freeze({
        handlerTimeout: 90_000,
    }),

    polling: Object.freeze({
        dropPendingUpdates: true,
        allowedUpdates: [
            "message",
            "edited_message",
            "callback_query",
            "chat_member",
            "my_chat_member",
        ],
    }),

    defaults: Object.freeze({
        commandCooldownSeconds: 3,
        maxWarnings: 3,
        defaultMuteMinutes: 10,
    }),

    // Baseline Telegram command menu entries (extended in Phase 3+)
    defaultCommands: Object.freeze([
        { command: "start", description: "Start the bot and view welcome info" },
        { command: "help", description: "Show available commands" },
        { command: "ping", description: "Check bot responsiveness" },
    ]),
});

module.exports = botConfig;

