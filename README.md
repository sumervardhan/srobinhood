# sRobinhood

A production-grade stock trading simulator built with real market data. Mimics the Robinhood experience — live prices, portfolio tracking, interactive charts, and a backtesting foundation for AI-powered trading strategies.

> Built as a portfolio project to demonstrate full-stack engineering, data pipeline design, and thoughtful UX engineering.

---

## What It Does

- **Trade stocks** from the top 10 US equities by market cap with real-time prices
- **Track your portfolio** with live P&L, market value, and cost basis
- **Visualize performance** with interactive historical charts across 1D / 5D / 1M / 3M / 1Y / 5Y / All time ranges
- **Manage cash** with deposits and withdrawals
- **Backtest strategies** by inserting historical trades and cash events at any past date
- **Watch prices move** with animated digit-level price updates

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Prisma ORM |
| Auth | NextAuth v4 — Google OAuth |
| Server state | TanStack Query (React Query) |
| Charts | Recharts |
| Market data | Alpaca Markets API |
| CI | GitHub Actions |

---

## Architecture

### Real-Time Price Pipeline — 3-Tier Fallback

Prices flow through a tiered system so the app always has data regardless of API availability:

```
Tier 1: Alpaca WebSocket (true real-time, sub-second updates)
   ↓ fails or disconnects
Tier 2: Alpaca REST polling (every 15 minutes via /v2/stocks/snapshots)
   ↓ no API keys configured
Tier 3: Simulated random walk (prevClose resets every 30 min to prevent drift)
```

On the server, a singleton `LivePriceState` holds the in-memory quote map. All API routes read from this shared state rather than hitting Alpaca on every request — avoiding rate limits and keeping latency near zero for per-request price lookups.

Prices stream to the browser via **Server-Sent Events** (SSE). The client keeps a single persistent `EventSource` connection with a staleness watchdog: if no message arrives within 20 minutes, it falls back to the REST polling path automatically.

### UI Throttling — Synchronized Updates

WebSocket feeds can fire many times per second. Naïvely calling `setState` on each message causes:
- Per-symbol re-renders (10 separate React commits)
- Prices updating at different times, creating a jarring staggered effect

The solution: incoming quotes are buffered in a `useRef`. A `setInterval` at **500ms** (configurable via `NEXT_PUBLIC_PRICE_THROTTLE_MS`) flushes the buffer — one React commit, all symbols update atomically in the same frame.

### Animated Price Display

Each price update runs a **slot-machine digit flip** on only the digits that changed:

- The price string is split character-by-character and compared with the previous value
- Changed digits get a CSS `translateY` animation: the old digit rolls out, the new one rolls in from the opposite direction
- Direction encodes meaning: **upward roll = green** (price rose), **downward roll = red** (price fell)
- Unchanged digits (`$`, `,`, `.`, and stable digits) render as static spans — no unnecessary DOM work
- CSS animation restart is handled via React's `key` prop remounting rather than JS class-toggle hacks, which is more reliable across browsers

Non-digit characters never animate. Font is `font-mono tabular-nums` so digit widths are stable — layout only shifts when a number crosses a power-of-10 boundary (e.g. `$999` → `$1,000`).

### Portfolio Chart — Historical Accuracy

**The core problem:** "What was my portfolio worth on March 1st?" is not a simple lookup. Naïve implementations multiply *current* share quantities by historical prices, which means buying a stock today retroactively inflates every past chart point.

**The solution — order replay:**

```typescript
function positionsAt(t: number): Map<string, number> {
  // Replay all orders sorted by createdAt up to timestamp t
  // Returns only the shares actually held at that moment in time
}
```

This correctly answers "what did I own at T?" for any T. The portfolio value at each historical point reflects what was actually held, not current holdings.

**What counts as portfolio value:** Stocks alone is wrong. Buying $20k of META moves $20k from spending power to stock value — the total should be unchanged. The chart tracks `stocks × price + cash` at every point. Cash at time T is reconstructed from `AccountTransaction` history the same way positions are reconstructed from `Order` history.

**Snapshot caching:** The first chart load computes all historical daily values (expensive: O(orders × days × symbols)). Each past day's total is persisted in a `PortfolioSnapshot` table. Subsequent loads hit the DB index — O(1) per day. Snapshots are immutable for past days; a backdated operation purges all snapshots from that date forward so they recompute correctly.

### Stock Charts — Data Quality

Several chart quality issues were solved that naive implementations miss:

- **Stock split adjustment:** Without `adjustment=all` on the Alpaca bars endpoint, GOOGL's 20:1 split (2022), NVDA's 10:1 split (2024), and AAPL's 4:1 split (2020) appear as 95% crashes in the chart. All historical bars are fetched split-and-dividend adjusted.

- **IPO date clamping:** "All Time" range is clamped to each stock's actual IPO date (not 5 years ago), so AAPL shows data from 1980 and META from 2012.

- **UTC timezone for daily bars:** Alpaca daily bars are timestamped at midnight UTC. Without explicit `timeZone: "UTC"` in date formatting, US users see dates shifted one day back. The tooltip and axis labels both use UTC for daily+ granularity, local time only for intraday.

- **Axis formatting:** Y-axis ticks use `.toFixed(2)` precision so `$2,280` and `$2,349` render as `$2.28k` and `$2.35k` rather than both collapsing to `$2.3k`. X-axis uses `computeTicks` to generate exactly N evenly-spaced timestamps rather than Recharts' default interval heuristic which clusters labels unevenly.

### Backtesting Foundation

The backtesting tab exposes the portfolio manipulation API that will underpin AI strategy evaluation:

- **Backdated trades:** `POST /api/backtest/trade` — inserts an `Order` with a historical `createdAt`, fetches the actual closing price from Alpaca for that date, then **replays the entire order history** to reconcile current positions and spending power. The replay is atomic inside a Prisma transaction — if any operation would result in a negative position or negative cash, the whole transaction rolls back.

- **Backdated cash:** `POST /api/backtest/cash` — same pattern for deposits/withdrawals.

- **Snapshot invalidation:** Any backdated operation deletes all `PortfolioSnapshot` rows from that date forward so the chart recomputes correctly.

- **Historical price lookup:** `GET /api/backtest/price?symbol=AAPL&date=2024-01-15` — returns the split-adjusted closing price for a symbol on or before a given date, used by the UI to auto-populate the price field.

This API design is deliberate: it's the same interface a future backtesting engine will call programmatically when simulating a strategy — insert trades at historical dates, observe the resulting portfolio state.

---

## Data Model

```
User
 ├── Position[]           — current holdings (denormalized for fast reads)
 ├── Order[]              — canonical trade history (source of truth)
 ├── AccountTransaction[] — all cash flows (deposits, withdrawals, buys, sells)
 ├── PortfolioSnapshot[]  — daily portfolio value cache (keyed by userId + date)
 └── TrackedStock[]       — user's watchlist
```

**Two sources of truth, one derived state:** `Position` and `User.spendingPower` are derived from `Order` and `AccountTransaction` history. After any backdated operation, both are recomputed by replaying the full history. This means the denormalized state can always be regenerated — there's no risk of it drifting out of sync permanently.

---

## API Routes

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/stocks/quotes` | Snapshot of all live prices |
| `GET` | `/api/stocks/quotes/stream` | SSE stream of live price updates |
| `GET` | `/api/stocks/[symbol]/chart` | Historical OHLCV bars for a symbol |
| `GET` | `/api/portfolio/positions` | Current holdings with cost basis |
| `GET` | `/api/portfolio/chart` | Portfolio value time series |
| `GET` | `/api/portfolio/spending-power` | Available cash |
| `GET` | `/api/portfolio/transactions` | Full transaction log |
| `POST` | `/api/orders` | Place a market buy or sell order |
| `POST` | `/api/portfolio/deposit` | Add cash |
| `POST` | `/api/portfolio/withdraw` | Remove cash |
| `POST` | `/api/backtest/trade` | Insert backdated buy/sell |
| `POST` | `/api/backtest/cash` | Insert backdated deposit/withdrawal |
| `GET` | `/api/backtest/price` | Historical closing price for a date |
| `GET` | `/api/backtest/events` | Chronological event log |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL) or an existing PostgreSQL instance
- [Alpaca Markets](https://app.alpaca.markets) account (free) for real market data
- Google OAuth credentials for authentication

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in environment variables
cp .env.example .env.local
# Required: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL,
#           GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
# Optional: ALPACA_API_KEY_ID, ALPACA_SECRET_KEY (enables real prices)

# 3. Start PostgreSQL
npm run db:up

# 4. Push schema and generate Prisma client
npm run db:migrate

# 5. Start the dev server
npm run dev
```

The app runs at `http://localhost:3000`. Without Alpaca keys, prices are simulated — the full UI works, charts use a random walk, and all features except historical bar data are functional.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | ✅ | Random secret for session signing (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | ✅ | Canonical app URL (e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `ALPACA_API_KEY_ID` | ⚪ | Enables real-time prices and historical charts |
| `ALPACA_SECRET_KEY` | ⚪ | Alpaca secret key |
| `NEXT_PUBLIC_PRICE_THROTTLE_MS` | ⚪ | UI price update interval in ms (default: `500`) |

---

## CI/CD

GitHub Actions runs on every push and PR:

```
npm ci → prisma generate → lint → type-check → build
```

`.next/cache` is cached between runs (keyed on `package-lock.json` + source file hashes) for fast incremental builds. No database is needed in CI — Prisma generates the typed client from the schema alone; all routes are server-rendered at runtime.

Production deploys via Vercel on merge to `main`. Preview deployments are created automatically for every PR.

---

## What's Next

The backtesting API above is the foundation for the planned AI strategy layer:

- **`PriceBar` table** — persist Alpaca historical bars for backtesting without repeated API calls
- **Strategy schema** — a typed config representing entry/exit conditions, position sizing, and risk management rules
- **Claude API integration** — natural language → structured strategy via `claude-sonnet-4-6` with JSON output
- **Backtesting engine** — replay strategies against `PriceBar` history, emit equity curve and metrics (Sharpe ratio, max drawdown, win rate)
- **Strategy dashboard** — create, review, run, and compare strategies; live paper trading mode
