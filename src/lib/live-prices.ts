/**
 * Live price feed. Uses Alpaca WebSocket when configured for real-time push,
 * Alpaca REST polling as fallback, or simulated random walk.
 */
import { fetchSnapshots, isAlpacaConfigured } from "@/lib/alpaca";
import { startAlpacaWebSocket } from "@/lib/alpaca-websocket";
import { SUPPORTED_STOCKS } from "@/lib/constants";
import type { StockQuote } from "@/types";

const INITIAL: Record<string, { price: number; prevClose: number }> = {
  NVDA: { price: 135.42, prevClose: 133.08 },
  AAPL: { price: 228.91, prevClose: 229.43 },
  GOOGL: { price: 178.25, prevClose: 177.13 },
  MSFT: { price: 415.5, prevClose: 412.3 },
  AMZN: { price: 198.75, prevClose: 199.8 },
  TSM: { price: 168.33, prevClose: 167.45 },
  META: { price: 585.2, prevClose: 581.1 },
  AVGO: { price: 312.8, prevClose: 315.1 },
  TSLA: { price: 388.5, prevClose: 382.9 },
  "BRK.B": { price: 412.0, prevClose: 410.8 },
};

export type NotifyPayload = { quotes: StockQuote[]; realtime: boolean };
type Subscriber = (payload: NotifyPayload) => void;

const ALPACA_FAIL_THRESHOLD = 3;

const HEARTBEAT_MS = 15 * 60 * 1000; // 15 min - keep stream alive when no new quotes (e.g. market closed)

/** Persists across Next.js hot reloads so we don't open duplicate Alpaca WebSocket connections */
const GLOBAL_KEY = "__srobinhood_live_prices";
const state = (
  typeof globalThis !== "undefined" && (globalThis as Record<string, unknown>)[GLOBAL_KEY]
    ? (globalThis as Record<string, unknown>)[GLOBAL_KEY]
    : ((globalThis as Record<string, unknown>)[GLOBAL_KEY] = {
        quotes: new Map<string, { price: number; prevClose: number }>(),
        subscribers: new Set<Subscriber>(),
        interval: null as ReturnType<typeof setInterval> | null,
        heartbeatInterval: null as ReturnType<typeof setInterval> | null,
        wsCleanup: null as (() => void) | null,
        useAlpaca: false,
        useAlpacaWs: false,
        alpacaFailCount: 0,
        simDayStartAt: Date.now() as number,
      })
) as {
  quotes: Map<string, { price: number; prevClose: number }>;
  subscribers: Set<Subscriber>;
  interval: ReturnType<typeof setInterval> | null;
  heartbeatInterval: ReturnType<typeof setInterval> | null;
  wsCleanup: (() => void) | null;
  useAlpaca: boolean;
  useAlpacaWs: boolean;
  alpacaFailCount: number;
  simDayStartAt: number;
};

function init() {
  if (state.quotes.size > 0) return;
  for (const [sym, data] of Object.entries(INITIAL)) {
    state.quotes.set(sym, { ...data });
  }
  for (const { symbol } of SUPPORTED_STOCKS) {
    if (!state.quotes.has(symbol)) {
      state.quotes.set(symbol, { price: 100, prevClose: 100 });
    }
  }
}

function tickSimulated() {
  init();
  // Reset prevClose every 30 minutes to keep simulated changePercent realistic
  const now = Date.now();
  if (now - state.simDayStartAt > 30 * 60 * 1000) {
    state.quotes.forEach((data, symbol) => {
      state.quotes.set(symbol, { ...data, prevClose: data.price });
    });
    state.simDayStartAt = now;
  }
  state.quotes.forEach((data, symbol) => {
    const delta = (Math.random() - 0.5) * (data.price * 0.001);
    const newPrice = Math.max(1, data.price + delta);
    state.quotes.set(symbol, { ...data, price: newPrice });
  });
  notify(false);
}

async function tickAlpaca() {
  try {
    const results = await fetchSnapshots();
    state.alpacaFailCount = 0;
    init();
    for (const { symbol, price, prevClose } of results) {
      state.quotes.set(symbol, { price, prevClose });
    }
    notify(false);
  } catch (e) {
    state.alpacaFailCount += 1;
    console.error("[live-prices] Alpaca REST fetch failed:", e);
    if (state.alpacaFailCount >= ALPACA_FAIL_THRESHOLD) {
      state.useAlpaca = false;
      state.useAlpacaWs = false;
      state.alpacaFailCount = 0;
      console.warn("[live-prices] Falling back to simulated prices");
    }
    tickSimulated();
  }
}

function tick() {
  if (state.useAlpaca && !state.useAlpacaWs) {
    void tickAlpaca();
  } else if (!state.useAlpacaWs) {
    tickSimulated();
  }
}

function toStockQuotes(): StockQuote[] {
  return SUPPORTED_STOCKS.map(({ symbol }) => {
    const data = state.quotes.get(symbol) ?? { price: 100, prevClose: 100 };
    const change = data.price - data.prevClose;
    const changePercent = data.prevClose > 0 ? (change / data.prevClose) * 100 : 0;
    return {
      symbol: symbol as StockQuote["symbol"],
      price: Math.round(data.price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      updatedAt: new Date().toISOString(),
    };
  });
}

function notify(realtime: boolean) {
  const quotes = toStockQuotes();
  const payload: NotifyPayload = { quotes, realtime };
  state.subscribers.forEach((fn) => {
    try {
      fn(payload);
    } catch (e) {
      console.error("[live-prices] subscriber error:", e);
    }
  });
}

let notifyTimeout: ReturnType<typeof setTimeout> | null = null;
const NOTIFY_DEBOUNCE_MS = 50;

function handleAlpacaQuote(symbol: string, bid: number, ask: number) {
  init();
  const data = state.quotes.get(symbol);
  if (!data) return;
  const price = bid > 0 && ask > 0 ? (bid + ask) / 2 : bid > 0 ? bid : ask;
  state.quotes.set(symbol, { ...data, price });
  if (!notifyTimeout) {
    notifyTimeout = setTimeout(() => {
      notifyTimeout = null;
      notify(true);
    }, NOTIFY_DEBOUNCE_MS);
  }
}

function startAlpacaWs() {
  if (state.wsCleanup) return;
  try {
    void fetchSnapshots().then((results) => {
      init();
      for (const { symbol, price, prevClose } of results) {
        state.quotes.set(symbol, { price, prevClose });
      }
      notify(true); // WebSocket connected = live stream
    });
    state.wsCleanup = startAlpacaWebSocket(
      (update) => handleAlpacaQuote(update.symbol, update.bid, update.ask),
      () => {
        if (state.heartbeatInterval) {
          clearInterval(state.heartbeatInterval);
          state.heartbeatInterval = null;
        }
        state.wsCleanup?.();
        state.wsCleanup = null;
        state.useAlpacaWs = false;
        state.useAlpaca = true;
        state.interval = setInterval(tick, HEARTBEAT_MS);
        if (process.env.NODE_ENV === "development") {
          console.log("[live-prices] Alpaca WebSocket failed, using REST polling every 15 min");
        }
      }
    );
    state.heartbeatInterval = setInterval(() => notify(true), HEARTBEAT_MS);
    if (process.env.NODE_ENV === "development") {
      console.log("[live-prices] Alpaca WebSocket started");
    }
  } catch (e) {
    console.error("[live-prices] Alpaca WebSocket failed to start:", e);
    state.useAlpacaWs = false;
    state.useAlpaca = true;
    state.interval = setInterval(tick, HEARTBEAT_MS);
  }
}

function startTicker() {
  if (state.interval || state.wsCleanup) return;
  state.useAlpaca = isAlpacaConfigured();

  if (state.useAlpaca) {
    state.useAlpacaWs = true;
    init();
    notify(false);
    startAlpacaWs();
  } else {
    state.useAlpaca = false;
    init();
    notify(false);
    state.interval = setInterval(tick, 1500);
  }
}

export function getLiveQuotes(): StockQuote[] {
  startTicker();
  init();
  return toStockQuotes();
}

export function getPriceForSymbol(symbol: string): number {
  init();
  return state.quotes.get(symbol)?.price ?? 100;
}

export function subscribe(fn: Subscriber): () => void {
  startTicker();
  state.subscribers.add(fn);
  fn({ quotes: getLiveQuotes(), realtime: state.useAlpacaWs });
  return () => {
    state.subscribers.delete(fn);
  };
}
