/**
 * Price worker — long-running function that owns the single Alpaca WebSocket
 * connection and publishes price updates to Redis for all SSE routes to consume.
 *
 * Called by the Vercel cron (every minute). Uses a Redis lock so only one
 * instance runs at a time; subsequent cron calls return immediately if a worker
 * is already active.
 *
 * Flow:
 *  1. Cron GET /api/worker/prices
 *  2. Acquire Redis lock (SET NX EX 120) — exit if already held
 *  3. Return 200 immediately; waitUntil() keeps the instance alive
 *  4. Background: connect Alpaca WS → live-prices.ts handles quotes →
 *     notify() publishes to Redis channel
 *  5. Lock is refreshed every 60 s; released on clean shutdown or expires
 *     naturally if the instance is killed (cron restarts within 120 s)
 */
import { waitUntil } from "@vercel/functions";
import { isAlpacaConfigured } from "@/lib/alpaca";
import { startAlpacaWebSocket } from "@/lib/alpaca-websocket";
import { fetchSnapshots } from "@/lib/alpaca";
import { SUPPORTED_STOCKS } from "@/lib/constants";
import {
  redis,
  isRedisConfigured,
  PRICES_CHANNEL,
  PRICES_SNAPSHOT_KEY,
  PRICES_SNAPSHOT_TTL_S,
  WORKER_LOCK_KEY,
  WORKER_LOCK_TTL_S,
} from "@/lib/redis";
import type { NotifyPayload, NotifySource } from "@/lib/live-prices";
import type { StockQuote } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** In-worker price state — isolated from other instances. */
const prices = new Map<string, { price: number; prevClose: number }>();

function initPrices() {
  for (const { symbol } of SUPPORTED_STOCKS) {
    if (!prices.has(symbol)) prices.set(symbol, { price: 100, prevClose: 100 });
  }
}

function toStockQuotes(): StockQuote[] {
  return SUPPORTED_STOCKS.map(({ symbol }) => {
    const d = prices.get(symbol) ?? { price: 100, prevClose: 100 };
    const change = d.price - d.prevClose;
    const changePercent = d.prevClose > 0 ? (change / d.prevClose) * 100 : 0;
    return {
      symbol: symbol as StockQuote["symbol"],
      price: Math.round(d.price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      updatedAt: new Date().toISOString(),
    };
  });
}

async function publish(source: NotifySource) {
  if (!redis) return;
  const r = redis;
  const payload: NotifyPayload = {
    quotes: toStockQuotes(),
    realtime: source === "realtime",
    source,
  };
  const payloadStr = JSON.stringify(payload);
  await r
    .multi()
    .publish(PRICES_CHANNEL, payloadStr)
    .set(PRICES_SNAPSHOT_KEY, payloadStr, "EX", PRICES_SNAPSHOT_TTL_S)
    .exec()
    .catch((e) => console.error("[worker] Redis publish failed:", e));
}

async function runWorker(): Promise<void> {
  if (!redis) return;
  const r = redis;

  initPrices();

  // Seed prices from Alpaca REST before WebSocket connects
  try {
    const results = await fetchSnapshots();
    for (const { symbol, price, prevClose } of results) {
      prices.set(symbol, { price, prevClose });
    }
    await publish("realtime");
  } catch (e) {
    console.error("[worker] Initial REST fetch failed:", e);
  }

  let lockRefreshInterval: ReturnType<typeof setInterval> | null = null;
  let notifyDebounce: ReturnType<typeof setTimeout> | null = null;

  await new Promise<void>((resolve) => {
    // Refresh the Redis lock every 60 s so it doesn't expire while we're running
    lockRefreshInterval = setInterval(() => {
      void r
        .expire(WORKER_LOCK_KEY, WORKER_LOCK_TTL_S)
        .catch((e) => console.error("[worker] Lock refresh failed:", e));
    }, 60_000);

    const wsCleanup = startAlpacaWebSocket(
      (update) => {
        const d = prices.get(update.symbol);
        if (!d) return;
        const price =
          update.bid > 0 && update.ask > 0
            ? (update.bid + update.ask) / 2
            : update.bid > 0
              ? update.bid
              : update.ask;
        prices.set(update.symbol, { ...d, price });

        // Debounce publishes to Redis (50 ms) to batch rapid WS quote bursts
        if (!notifyDebounce) {
          notifyDebounce = setTimeout(() => {
            notifyDebounce = null;
            void publish("realtime");
          }, 50);
        }
      },
      (err) => {
        console.error("[worker] Alpaca WebSocket error:", err.message);
        wsCleanup();
        resolve(); // Let the instance die; cron will restart
      }
    );

    // Cap lifetime at just under maxDuration so we shut down cleanly
    setTimeout(() => {
      wsCleanup();
      resolve();
    }, 290_000);
  });

  if (lockRefreshInterval) clearInterval(lockRefreshInterval);
  if (notifyDebounce) clearTimeout(notifyDebounce);
  await r.del(WORKER_LOCK_KEY).catch(() => {});
}

export async function GET() {
  if (!isRedisConfigured() || !isAlpacaConfigured()) {
    return Response.json(
      { error: "REDIS_URL and Alpaca credentials are required" },
      { status: 400 }
    );
  }

  // Only one worker at a time — SET NX returns "OK" if lock was acquired
  const acquired = await redis!.set(WORKER_LOCK_KEY, "1", "EX", WORKER_LOCK_TTL_S, "NX");
  if (!acquired) {
    return Response.json({ status: "already_running" });
  }

  console.log("[worker] Starting price worker");
  waitUntil(runWorker());
  return Response.json({ status: "started" });
}
