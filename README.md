# sRobinhood

A Robinhood-style frontend for trading the top 10 US stocks by market cap. The UI is self-contained; it expects data from your own pipeline (parquet, DB, webhooks, etc.).

## Features

- **10 supported stocks**: NVDA, AAPL, GOOGL, MSFT, AMZN, TSM, META, AVGO, TSLA, BRK.B
- **Google sign-in**: Log in with your Google account (NextAuth)
- **Live prices**: Polling every 5s (replace with WebSocket when your pipeline supports it)
- **Positions**: View holdings; data from your backend
- **Buy / Sell**: Market orders at the current quote (backend executes at live rate)

## Setup

1. **Install and env**

   ```bash
   npm install
   cp .env.example .env.local
   ```

2. **Google OAuth**

   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Create OAuth 2.0 Client ID (Web application)
   - Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   - Set in `.env.local`:
     - `GOOGLE_CLIENT_ID`
     - `GOOGLE_CLIENT_SECRET`
     - `NEXTAUTH_URL=http://localhost:3000` **(required — without it the app can stick on “Loading…”)**
     - `NEXTAUTH_SECRET` (e.g. `openssl rand -base64 32`)

3. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign in with Google, then use the dashboard.

## Data pipeline integration

The UI talks to these APIs. Replace the mock implementations with your pipeline:

| What        | Frontend expects                         | You provide |
|------------|------------------------------------------|-------------|
| **Quotes** | `GET /api/stocks/quotes` → `StockQuote[]` | Serve from parquet/DB/stream; optionally WebSocket for live tickers. |
| **Positions** | `GET /api/portfolio/positions` → `Position[]` | Resolve user from session; read from your DB. |
| **Orders** | `POST /api/orders` (body: `OrderRequest`) → `Order` | Validate, execute at live rate, persist to DB. |

- **Auth**: Session comes from NextAuth; use `getServerSession(authOptions)` in API routes to get `session.user.id` and scope positions/orders by user.
- **Live prices**: Currently the app polls `/api/stocks/quotes` every 5s. You can add a WebSocket endpoint and switch the client to it when your pipeline supports real-time quotes.

Types are in `src/types/index.ts`; API client in `src/lib/api.ts`.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — run production server
- `npm run lint` — ESLint
