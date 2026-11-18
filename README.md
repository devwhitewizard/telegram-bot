# Telegram Group Management & Entertainment Bot

A modular, scalable Telegram bot built with **Node.js (CommonJS)**, **Telegraf**, **Prisma ORM**, **SQLite** (PostgreSQL-ready), and **Pino**.


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


## Running & Testing

```bash
# Run all tests
npm test

# Start in development (watch mode)
npm run dev

# Start in production
npm start
```

---

## External API Integrations (Phase 10)

All external API credentials are **global to the bot** and loaded exclusively from `.env` via `src/config/env.js` (never stored per group in `GroupSettings` or exposed in logs/messages).

| Command | Provider | API Key Required? | Cooldown | Notes |
| --- | --- | --- | --- | --- |
| `/weather <city>` | Open-Meteo | No (keyless) | 5s | Returns °C/°F, humidity, wind, condition |
| `/ai <prompt>` | OpenAI-compatible (`AI_PROVIDER`) | **Yes** (`AI_API_KEY`) | 15s + single-flight | Configurable `AI_MODEL` & `AI_BASE_URL`; truncates >3800 chars |
| `/github <user\|owner/repo>` | GitHub REST API | Optional (`GITHUB_TOKEN`) | 5s | Unauthenticated limit: 60 req/hr |
| `/npm <package>` | NPM Registry + Downloads API | No (keyless) | 5s | Latest version, author, weekly downloads |
| `/news <topic>` | GNews / NewsAPI (`NEWS_PROVIDER`) | **Yes** (`NEWS_API_KEY`) | 15s + single-flight | Returns up to 5 articles |
| `/translate <lang> <text>` | MyMemory (default) or LibreTranslate | Optional (`TRANSLATE_API_KEY`) | 10s + single-flight | MyMemory has daily free-tier limits |
| `/currency <amt> <from> <to>` | Frankfurter (ECB) | No (keyless) | 5s | ECB reference rates |
| `/shorten <url>` | is.gd | No (keyless) | 10s + single-flight | Blocks non-HTTP(S), credentials, and private/localhost IPs |
| `/qr <text\|url>` | Local `qrcode` library | No (offline) | 5s | Generates PNG locally without external requests |

When an optional API key (`AI_API_KEY`, `NEWS_API_KEY`) is missing, the bot starts normally and returns a clear configuration notice if that command is invoked.

---

## Deployment Guide

### 1. Local Environment

1. **Clone & install dependencies:**
   ```bash
   git clone <your-repo-url>
   cd telegram-group-bot
   npm install
   ```
2. **Create `.env` from `.env.example`:**
   ```bash
   cp .env.example .env
   ```
   Fill in `BOT_TOKEN`, `BOT_USERNAME`, and `DATABASE_URL="file:./dev.db"`.
3. **Generate Prisma Client & apply migrations:**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate -- --name init
   ```
4. **Start the bot:**
   ```bash
   npm run dev    # development (auto-reload)
   npm start      # production
   ```

---

### 2. Deploy to Render

> **Important (Database Persistence):** Render's filesystem is ephemeral on free/standard instances, so a local SQLite file (`dev.db`) will reset on every redeploy. For persistent data on Render, create a **Render PostgreSQL** database, change `provider = "sqlite"` to `provider = "postgresql"` in `src/database/prisma/schema.prisma`, and use the PostgreSQL connection string for `DATABASE_URL`.

1. Push your repository to GitHub/GitLab.
2. In the Render Dashboard, click **New +** → **Background Worker** (recommended for long polling; no public port needed).
3. Connect your repository and configure:
   - **Build Command:**
     ```bash
     npm install && npm run prisma:generate && npm run prisma:deploy
     ```
   - **Start Command:**
     ```bash
     npm start
     ```
4. Add **Environment Variables** in Render:
   - `NODE_ENV=production`
   - `BOT_TOKEN=<your_telegram_bot_token>`
   - `BOT_USERNAME=<your_bot_username>`
   - `DATABASE_URL=<your_render_postgres_url_or_sqlite_file_url>`
5. Click **Create Background Worker**.

---

### 3. Deploy to Heroku

> **Important (Database Persistence):** Heroku's filesystem is ephemeral, so use **Heroku Postgres** instead of SQLite in production. Update `provider = "postgresql"` in `src/database/prisma/schema.prisma` and commit that change before pushing.

1. Ensure `Procfile` is present in the project root (`worker: npm start`).
2. Create the Heroku app and attach PostgreSQL:
   ```bash
   heroku create your-bot-app-name
   heroku addons:create heroku-postgresql:essential-0
   ```
3. Set the required environment variables:
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set BOT_TOKEN=your_telegram_bot_token
   heroku config:set BOT_USERNAME=your_bot_username
   ```
   *(Heroku automatically sets `DATABASE_URL` when you attach `heroku-postgresql`.)*
4. Deploy and run Prisma migrations:
   ```bash
   git push heroku main
   heroku run npm run prisma:deploy
   heroku ps:scale worker=1
   ```
5. View logs:
   ```bash
   heroku logs --tail
   ```



