/**
 * Alpaca Market Data API v2 client.
 * Uses REST for snapshots (live quotes) and historical bars.
 * Sign up at https://alpaca.markets for free API keys.
 */
import { STOCK_SYMBOLS } from "./constants";

const DATA_BASE = "https://data.alpaca.markets/v2";
const FEED = "iex"; // Free tier uses IEX; use "sip" for paid

function getHeaders(): Record<string, string> {
  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_SECRET_KEY;
  if (!key || !secret) {
    throw new Error("Missing ALPACA_API_KEY_ID or ALPACA_SECRET_KEY");
  }
  return {
    "APCA-API-KEY-ID": key,
    "APCA-API-SECRET-KEY": secret,
  };
}

export function isAlpacaConfigured(): boolean {
  return !!(process.env.ALPACA_API_KEY_ID && process.env.ALPACA_SECRET_KEY);
}

type AlpacaSnapshot = {
  latestTrade?: { p: number; t: string };
  latestQuote?: { ap: number; bp: number; t: string };
  dailyBar?: { o: number; h: number; l: number; c: number; v: number; t: string };
  prevDailyBar?: { o: number; h: number; l: number; c: number; v: number; t: string };
};

export type AlpacaQuote = {
  symbol: string;
  price: number;
  prevClose: number;
  updatedAt: string;
};

export async function fetchSnapshots(): Promise<AlpacaQuote[]> {
  const symbols = STOCK_SYMBOLS.join(",");
  const url = `${DATA_BASE}/stocks/snapshots?symbols=${encodeURIComponent(symbols)}&feed=${FEED}`;
  const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Alpaca snapshots failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as Record<string, AlpacaSnapshot>;

  return STOCK_SYMBOLS.map((symbol) => {
    const snap = data[symbol];
    const price =
      snap?.latestTrade?.p ??
      (snap?.latestQuote?.ap && snap?.latestQuote?.bp
        ? (snap.latestQuote.ap + snap.latestQuote.bp) / 2
        : snap?.dailyBar?.c) ??
      0;
    const prevClose = snap?.prevDailyBar?.c ?? snap?.dailyBar?.o ?? price;
    return {
      symbol,
      price: Math.round(price * 100) / 100,
      prevClose: Math.round(prevClose * 100) / 100,
      updatedAt: snap?.latestTrade?.t ?? snap?.latestQuote?.t ?? new Date().toISOString(),
    };
  }).filter((q) => q.price > 0);
}

type AlpacaBar = { t: string; o: number; h: number; l: number; c: number; v: number };

export async function fetchBars(
  symbol: string,
  timeframe: "1Min" | "1Hour" | "1Day",
  start: Date,
  end: Date,
  limit = 10000
): Promise<{ t: number; v: number; o?: number }[]> {
  const url = new URL(`${DATA_BASE}/stocks/${encodeURIComponent(symbol)}/bars`);
  url.searchParams.set("timeframe", timeframe);
  url.searchParams.set("start", start.toISOString().slice(0, 19) + "Z");
  url.searchParams.set("end", end.toISOString().slice(0, 19) + "Z");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("feed", FEED);
  url.searchParams.set("adjustment", "all"); // split + dividend adjusted

  const res = await fetch(url.toString(), {
    headers: getHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Alpaca bars failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { bars?: AlpacaBar[] };
  const bars = json.bars ?? [];
  return bars.map((b) => ({
    t: new Date(b.t).getTime(),
    v: b.c,
    o: b.o,
  }));
}
