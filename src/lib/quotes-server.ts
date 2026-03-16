/**
 * Server-side quotes — reads from Redis snapshot when available (all Vercel
 * instances), falls back to the in-process live-prices singleton (local dev).
 */
import { getLiveQuotes, getPriceForSymbol as getLocalPrice } from "@/lib/live-prices";
import { redis, isRedisConfigured, PRICES_SNAPSHOT_KEY } from "@/lib/redis";
import type { StockQuote } from "@/types";
import type { NotifyPayload } from "@/lib/live-prices";

export async function getQuotesServer(): Promise<StockQuote[]> {
  if (isRedisConfigured() && redis) {
    const snapshot = await redis.get(PRICES_SNAPSHOT_KEY).catch(() => null);
    if (snapshot) {
      const payload = JSON.parse(snapshot) as NotifyPayload;
      if (payload.quotes?.length) return payload.quotes;
    }
  }
  return getLiveQuotes();
}

export async function getPriceForSymbol(symbol: string): Promise<number> {
  if (isRedisConfigured() && redis) {
    const snapshot = await redis.get(PRICES_SNAPSHOT_KEY).catch(() => null);
    if (snapshot) {
      const payload = JSON.parse(snapshot) as NotifyPayload;
      const quote = payload.quotes?.find((q) => q.symbol === symbol);
      if (quote) return quote.price;
    }
  }
  return getLocalPrice(symbol);
}
