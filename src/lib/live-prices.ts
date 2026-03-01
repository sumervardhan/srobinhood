/**
 * Live price feed. Uses Alpaca when configured, otherwise simulated random walk.
 * Replace with your streaming pipeline when ready.
 */
import { fetchSnapshots, isAlpacaConfigured } from "@/lib/alpaca";
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

type Subscriber = (quotes: StockQuote[]) => void;

const ALPACA_FAIL_THRESHOLD = 3;

const state = {
  quotes: new Map<string, { price: number; prevClose: number }>(),
  subscribers: new Set<Subscriber>(),
  interval: null as ReturnType<typeof setInterval> | null,
  useAlpaca: false,
  alpacaFailCount: 0,
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
  state.quotes.forEach((data, symbol) => {
    const delta = (Math.random() - 0.5) * (data.price * 0.001);
    const newPrice = Math.max(1, data.price + delta);
    state.quotes.set(symbol, { ...data, price: newPrice });
  });
  notify();
}

async function tickAlpaca() {
  try {
    const results = await fetchSnapshots();
    state.alpacaFailCount = 0;
    init();
    for (const { symbol, price, prevClose } of results) {
      state.quotes.set(symbol, { price, prevClose });
    }
    notify();
  } catch (e) {
    state.alpacaFailCount += 1;
    console.error("[live-prices] Alpaca fetch failed:", e);
    if (state.alpacaFailCount >= ALPACA_FAIL_THRESHOLD) {
      state.useAlpaca = false;
      state.alpacaFailCount = 0;
      console.warn("[live-prices] Falling back to simulated prices after repeated Alpaca failures");
    }
    tickSimulated();
  }
}

function tick() {
  if (state.useAlpaca) {
    void tickAlpaca();
  } else {
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

function notify() {
  const quotes = toStockQuotes();
  state.subscribers.forEach((fn) => {
    try {
      fn(quotes);
    } catch (e) {
      console.error("[live-prices] subscriber error:", e);
    }
  });
}

function startTicker() {
  if (state.interval) return;
  state.useAlpaca = isAlpacaConfigured();
  init();
  notify();

  if (state.useAlpaca) {
    void tickAlpaca();
    state.interval = setInterval(tick, 2000);
  } else {
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
  fn(getLiveQuotes());
  return () => {
    state.subscribers.delete(fn);
  };
}
