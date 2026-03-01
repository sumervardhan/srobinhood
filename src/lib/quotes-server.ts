/**
 * Server-side quotes. Delegates to live-prices for current data.
 * Replace with your pipeline when ready.
 */
import { getLiveQuotes, getPriceForSymbol } from "@/lib/live-prices";
import type { StockQuote } from "@/types";

export function getQuotesServer(): StockQuote[] {
  return getLiveQuotes();
}

export { getPriceForSymbol };
