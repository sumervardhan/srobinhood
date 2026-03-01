# sRobinhood

A Robinhood-style frontend for trading the top 10 US stocks by market cap. The UI is self-contained; it expects data from your own pipeline (parquet, DB, webhooks, etc.).

## Features

- **10 supported stocks**: NVDA, AAPL, GOOGL, MSFT, AMZN, TSM, META, AVGO, TSLA, BRK.B
- **Google sign-in** (or **Dev login** in Cursor’s browser when `ALLOW_DEV_LOGIN=true`)
- **Tabs**: Portfolio, Tracked Stocks, All Stocks
- **Live prices**: SSE stream (real-time); uses Alpaca when configured, otherwise simulated data
- **Positions & orders**: Persisted in PostgreSQL (Prisma)
- **Buy / Sell**: Market orders at the current quote; positions update in DB

## Setup

1. **Install and env**

   ```bash
   npm install
   cp .env.example .env.local
   ```

2. **PostgreSQL (local)**

   - **DATABASE_URL** is set in `.env.local` for the Docker-based local DB.
   - **If you installed Docker via Homebrew:** Compose is not included. Install it so the commands below work:
     ```bash
     brew install docker-compose
     ```
   - Start Postgres and run migrations:
     ```bash
     npm run db:up
     npm run db:migrate
     ```
     (First run of `db:migrate` will prompt for a migration name; use `init` or leave default.)
   - To use a **hosted Postgres** (Neon, Supabase, RDS, etc.) instead of Docker: set `DATABASE_URL` in `.env.local` to that connection string and run only `npm run db:migrate`.

3. **Google OAuth**

   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Create OAuth 2.0 Client ID (Web application)
   - Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Set in `.env.local`:
     - `GOOGLE_CLIENT_ID`
     - `GOOGLE_CLIENT_SECRET`
     - `NEXTAUTH_URL=http://localhost:3000` **(required — without it the app can stick on “Loading…”)**
     - `NEXTAUTH_SECRET` (e.g. `openssl rand -base64 32`)

4. **Alpaca (optional — real market data)**

   - Sign up at [Alpaca](https://app.alpaca.markets) (free paper account)
   - Create API keys under Paper Trading
   - Add to `.env.local`:
     ```
     ALPACA_API_KEY_ID=your_key_id
     ALPACA_SECRET_KEY=your_secret
     ```
   - With these set, live quotes and charts use Alpaca’s IEX feed. Without them, simulated data is used.

5. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign in with Google, then use the dashboard.

## Data

- **Positions, orders, and tracked symbols** are stored in PostgreSQL via Prisma (`prisma/schema.prisma`). Users are upserted on first request.
- **Quotes & charts**: When `ALPACA_API_KEY_ID` and `ALPACA_SECRET_KEY` are set, the app uses Alpaca’s Market Data API (snapshots for live prices, bars for historical charts). Otherwise, simulated data is used.

Types: `src/types/index.ts`. API client: `src/lib/api.ts`.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — production server
- `npm run lint` — ESLint
- `npm run db:up` — start local Postgres (Docker)
- `npm run db:down` — stop local Postgres
- `npm run db:migrate` — run Prisma migrations
- `npm run db:studio` — open Prisma Studio (DB UI)

## Production

- **Database:** Use a **managed Postgres** (e.g. Neon, Supabase, AWS RDS). Set `DATABASE_URL` in your hosting environment (Vercel, Railway, etc.); do **not** run the app against the same Docker Compose stack as in dev.
- **Migrations:** Run them in CI or as a deploy step, e.g. `npx prisma migrate deploy` (uses existing migrations; no prompt). Never run `migrate dev` in production.
- **Secrets:** Keep `NEXTAUTH_SECRET`, `GOOGLE_*`, and `DATABASE_URL` in env only; no defaults or hardcoding for production.
