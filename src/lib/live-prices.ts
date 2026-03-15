/**
 * Live price feed. Uses Alpaca WebSocket when configured for real-time push,
 * Alpaca REST polling as fallback. Simulation fallback is intentionally removed —
 * if all data sources fail the "error" source is broadcast instead.
 */
import { fetchSnapshots, isAlpacaConfigured } from "@/lib/alpaca";
import { startAlpacaWebSocket } from "@/lib/alpaca-websocket";
import { SUPPORTED_STOCKS } from "@/lib/constants";
import type { StockQuote } from "@/types";

export type NotifySource = "realtime" | "rest" | "error";
export type NotifyPayload = {
  quotes: StockQuote[];
  /** @deprecated use `source` instead */
  realtime: boolean;
  source: NotifySource;
};
type Subscriber = (payload: NotifyPayload) => void;

const ALPACA_FAIL_THRESHOLD = 3;

const HEARTBEAT_MS = 15 * 60 * 1000; // 15 min - keep stream alive when no new quotes (e.g. market closed)

/** Bump this key when the state shape changes to force fresh globalThis state on hot-reload */
const GLOBAL_KEY = "__srobinhood_live_prices_v2";
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
        currentSource: "rest" as NotifySource,
        // Simulation state (managed by simulation.ts via setSimulationMode)
        simulationMode: false as boolean,
        simulationDeltaPercents: null as Map<string, number[]> | null,
        simulationBarIndex: 0 as number,
        simulationInterval: null as ReturnType<typeof setInterval> | null,
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
  currentSource: NotifySource;
  simulationMode: boolean;
  simulationDeltaPercents: Map<string, number[]> | null;
  simulationBarIndex: number;
  simulationInterval: ReturnType<typeof setInterval> | null;
};

function init() {
  if (state.quotes.size > 0) return;
  for (const { symbol } of SUPPORTED_STOCKS) {
    if (!state.quotes.has(symbol)) {
      state.quotes.set(symbol, { price: 100, prevClose: 100 });
    }
  }
}

/**
 * Simulation tick — replays intraday delta-percents from a previous trading day.
 * Each deltaPercent[i] is the % change from the first bar's open for that bar.
 * Applied on top of each symbol's prevClose as the base price.
 */
function tickSimulated(deltaPercents: Map<string, number[]>, barIndex: number) {
  init();
  state.quotes.forEach((data, symbol) => {
    const deltas = deltaPercents.get(symbol);
    if (!deltas || deltas.length === 0) return;
    const delta = deltas[barIndex % deltas.length];
    const newPrice = Math.max(1, data.prevClose * (1 + delta / 100));
    state.quotes.set(symbol, { ...data, price: newPrice });
  });
  notify("rest");
}

async function tickAlpaca() {
  try {
    const results = await fetchSnapshots();
    state.alpacaFailCount = 0;
    init();
    for (const { symbol, price, prevClose } of results) {
      state.quotes.set(symbol, { price, prevClose });
    }
    notify("rest");
  } catch (e) {
    state.alpacaFailCount += 1;
    console.error("[live-prices] Alpaca REST fetch failed:", e);
    if (state.alpacaFailCount >= ALPACA_FAIL_THRESHOLD) {
      state.useAlpaca = false;
      state.useAlpacaWs = false;
      state.alpacaFailCount = 0;
      if (state.interval) {
        clearInterval(state.interval);
        state.interval = null;
      }
      console.error("[live-prices] Alpaca REST failed too many times — entering error state");
      notify("error");
    }
  }
}

function tick() {
  if (state.simulationMode) return; // simulation interval handles its own ticking
  if (state.useAlpaca && !state.useAlpacaWs) {
    void tickAlpaca();
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

function notify(source: NotifySource) {
  state.currentSource = source;
  const quotes = toStockQuotes();
  const payload: NotifyPayload = { quotes, realtime: source === "realtime", source };
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
  if (state.simulationMode) return; // simulation overrides live quotes
  init();
  const data = state.quotes.get(symbol);
  if (!data) return;
  const price = bid > 0 && ask > 0 ? (bid + ask) / 2 : bid > 0 ? bid : ask;
  state.quotes.set(symbol, { ...data, price });
  if (!notifyTimeout) {
    notifyTimeout = setTimeout(() => {
      notifyTimeout = null;
      notify("realtime");
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
      notify("realtime"); // WebSocket connected = live stream
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
        if (!state.simulationMode) {
          state.interval = setInterval(tick, HEARTBEAT_MS);
          if (process.env.NODE_ENV === "development") {
            console.log("[live-prices] Alpaca WebSocket failed, using REST polling every 15 min");
          }
        }
      }
    );
    state.heartbeatInterval = setInterval(() => notify("realtime"), HEARTBEAT_MS);
    if (process.env.NODE_ENV === "development") {
      console.log("[live-prices] Alpaca WebSocket started");
    }
  } catch (e) {
    console.error("[live-prices] Alpaca WebSocket failed to start:", e);
    state.useAlpacaWs = false;
    state.useAlpaca = true;
    if (!state.simulationMode) {
      state.interval = setInterval(tick, HEARTBEAT_MS);
    }
  }
}

function startTicker() {
  if (state.interval || state.wsCleanup) return;
  state.useAlpaca = isAlpacaConfigured();

  if (state.useAlpaca) {
    state.useAlpacaWs = true;
    init();
    notify("rest"); // initial notify before WS connects
    startAlpacaWs();
  } else {
    state.useAlpaca = false;
    init();
    notify("error"); // no data source configured
  }
}

/**
 * Enable or disable simulation mode. When enabled, prices are driven by
 * `deltaPercents` (intraday % changes from a previous trading day), cycling
 * through bars at ~1.5 s per tick.
 *
 * Called exclusively by `src/lib/simulation.ts` — live-prices.ts must not
 * import simulation.ts to avoid a circular dependency.
 */
export function setSimulationMode(enabled: boolean, deltaPercents: Map<string, number[]> | null) {
  state.simulationMode = enabled;
  if (enabled && deltaPercents) {
    state.simulationDeltaPercents = deltaPercents;
    state.simulationBarIndex = 0;
    if (!state.simulationInterval) {
      state.simulationInterval = setInterval(() => {
        if (state.simulationDeltaPercents) {
          tickSimulated(state.simulationDeltaPercents, state.simulationBarIndex);
          state.simulationBarIndex++;
        }
      }, 1500);
    }
  } else {
    if (state.simulationInterval) {
      clearInterval(state.simulationInterval);
      state.simulationInterval = null;
    }
    state.simulationDeltaPercents = null;
    state.simulationBarIndex = 0;
    // Resume normal operation
    if (state.useAlpaca && !state.useAlpacaWs && !state.interval) {
      state.interval = setInterval(tick, HEARTBEAT_MS);
    }
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
  fn({
    quotes: getLiveQuotes(),
    realtime: state.currentSource === "realtime",
    source: state.currentSource,
  });
  return () => {
    state.subscribers.delete(fn);
  };
}
