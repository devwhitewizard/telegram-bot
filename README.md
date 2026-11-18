# Telegram Group Management & Entertainment Bot

A modular, scalable Telegram bot built with **Node.js (CommonJS)**, **Telegraf**, **Prisma ORM**, **SQLite** (PostgreSQL-ready), and **Pino**.

---

## Project Structure (Phase 1–3)

```text
telegram-group-bot/
├── src/
│   ├── bot.js                          # Telegraf factory: global middlewares + command registry
│   ├── index.js                        # Entry point: DB init, bot launch, graceful shutdown
│   ├── config/
│   │   ├── env.js                      # Environment loading & validation
│   │   ├── botConfig.js                # Non-secret bot defaults
│   │   └── database.js                 # Singleton PrismaClient + init/disconnect
│   ├── commands/
│   │   ├── index.js                    # Recursive command discovery & registration
│   │   └── utility/
│   │       ├── start.js
│   │       ├── help.js
│   │       └── ping.js
│   ├── middlewares/
│   │   ├── errorMiddleware.js          # Global error boundary
│   │   ├── userRegistrationMiddleware.js
│   │   ├── groupRegistrationMiddleware.js
│   │   ├── groupMiddleware.js
│   │   ├── privateChatMiddleware.js
│   │   ├── adminMiddleware.js
│   │   └── cooldownMiddleware.js
│   ├── database/
│   │   ├── prisma/
│   │   │   └── schema.prisma           # SQLite schema (PostgreSQL-portable)
│   │   └── repositories/
│   │       ├── helpers.js              # BigInt & ID validation helpers
│   │       ├── userRepository.js
│   │       ├── groupRepository.js
│   │       ├── settingsRepository.js
│   │       ├── warningRepository.js
│   │       ├── moderationRepository.js
│   │       └── gameRepository.js
│   └── utils/
│       └── logger.js                   # Pino structured logger
├── tests/
│   ├── phase1.test.js
│   └── phase2_3.test.js
├── logs/
├── .env.example
├── .gitignore
└── package.json
```

---

## Setup & Database (SQLite + Prisma)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Set `BOT_TOKEN` and ensure `DATABASE_URL` is configured:
   ```env
   DATABASE_URL="file:./dev.db"
   ```
   *(Prisma resolves relative `file:` paths relative to `src/database/prisma/schema.prisma`, so `dev.db` is created inside `src/database/prisma/` and ignored by Git.)*

3. **Generate Prisma Client & run migrations:**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate -- --name init
   ```
   Useful database scripts in `package.json`:
   - `npm run prisma:generate` — Regenerate Prisma Client after schema edits.
   - `npm run prisma:migrate` — Create and apply a new development migration.
   - `npm run prisma:deploy` — Apply pending migrations in production.
   - `npm run db:push` — Push schema changes without creating a migration file.
   - `npm run prisma:studio` — Open Prisma Studio GUI.

   **Migrating to PostgreSQL later:** Change `provider = "sqlite"` to `provider = "postgresql"` in `src/database/prisma/schema.prisma` and update `DATABASE_URL` in `.env`. Because all queries are isolated inside `src/database/repositories/` using Prisma's typed API and `BigInt` for Telegram IDs, no command or service code needs to change.

---

## Architecture Overview

### Repository Layer (`src/database/repositories/`)
All Prisma queries live in dedicated repository modules (`userRepository`, `groupRepository`, `settingsRepository`, `warningRepository`, `moderationRepository`, `gameRepository`). Commands and services never call `prisma` directly, keeping business logic decoupled from persistence and making future database changes trivial.

### Middleware Architecture (`src/middlewares/`)
Telegraf processes updates through an onion-style middleware pipeline using `(ctx, next)`:
- `ctx` carries the Telegram update, helper methods (`ctx.reply`, `ctx.telegram`), and `ctx.state` for sharing data across middlewares.
- `await next()` passes control to the next middleware or handler, then resumes the outer middleware when downstream finishes.
- Omitting `next()` intentionally stops the chain (used by `groupMiddleware`, `privateChatMiddleware`, `adminMiddleware`, and `cooldownMiddleware` when a check fails).

**Execution order in `src/bot.js`:**
1. `errorMiddleware` — Wraps everything in `try/catch` so unhandled errors are logged and users receive a safe generic message.
2. `userRegistrationMiddleware` — Upserts `ctx.from` and attaches `ctx.state.user`.
3. `groupRegistrationMiddleware` — Upserts group/supergroup + default `GroupSettings` and attaches `ctx.state.group` / `ctx.state.groupSettings`.
4. **Per-command middlewares** (attached automatically by `src/commands/index.js`):
   `groupMiddleware` / `privateChatMiddleware` → `adminMiddleware` → `cooldownMiddleware` → `cmd.execute(ctx)`.

### Centralized Command Registration (`src/commands/index.js`)
`registerCommands(bot)` recursively scans `src/commands/` for `.js` modules, validates their shape, builds per-command middleware chains from metadata, and collects non-hidden entries for `bot.telegram.setMyCommands()`.

**Adding a new command:**
Create a file in any subdirectory under `src/commands/` (e.g., `src/commands/utility/example.js`):
```js
module.exports = {
    name: "example",
    description: "Short description shown in /help and Telegram menu",
    groupOnly: false,   // optional
    privateOnly: false, // optional
    adminOnly: false,   // optional
    cooldown: 3,        // optional (seconds)
    hidden: false,      // optional
    execute: async (ctx) => {
        await ctx.reply("Hello from /example!");
    },
};
```
No changes to `bot.js` or `index.js` are required.

---

## Running & Testing

```bash
# Run all tests
npm test

# Start in development (watch mode)
npm run dev

# Start in production
npm start
```

