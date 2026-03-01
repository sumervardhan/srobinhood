/**
 * Live quotes for supported stocks.
 * Replace this with your data pipeline: read from parquet, DB, or forward from a real-time source.
 */
import { NextResponse } from "next/server";
import { SUPPORTED_STOCKS } from "@/lib/constants";
import type { StockQuote } from "@/types";

// Mock live-ish prices (pipeline would provide real data)
const MOCK_PRICES: Record<string, { price: number; change: number }> = {
  NVDA: { price: 135.42, change: 2.34 },
  AAPL: { price: 228.91, change: -0.52 },
  GOOGL: { price: 178.25, change: 1.12 },
  MSFT: { price: 415.5, change: 3.2 },
  AMZN: { price: 198.75, change: -1.05 },
  TSM: { price: 168.33, change: 0.88 },
  META: { price: 585.2, change: 4.1 },
  AVGO: { price: 312.8, change: -2.3 },
  TSLA: { price: 388.5, change: 5.6 },
  "BRK.B": { price: 412.0, change: 1.2 },
};

export async function GET() {
  const quotes: StockQuote[] = SUPPORTED_STOCKS.map(({ symbol }) => {
    const { price, change } = MOCK_PRICES[symbol] ?? { price: 100, change: 0 };
    return {
      symbol,
      price,
      change,
      changePercent: (change / (price - change)) * 100,
      updatedAt: new Date().toISOString(),
    };
  });
  return NextResponse.json(quotes);
}
