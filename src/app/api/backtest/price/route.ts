export const dynamic = 'force-dynamic';

/**
 * GET /api/backtest/price?symbol=AAPL&date=2024-01-15
 * Returns the historical closing price for a symbol on or before the given date.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchBars, isAlpacaConfigured } from "@/lib/alpaca";
import { STOCK_SYMBOLS } from "@/lib/constants";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol");
  const date = url.searchParams.get("date");

  if (!symbol || !STOCK_SYMBOLS.includes(symbol as (typeof STOCK_SYMBOLS)[number]) || !date) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  if (!isAlpacaConfigured()) {
    return NextResponse.json({ error: "Alpaca not configured" }, { status: 400 });
  }

  const target = new Date(date);
  if (isNaN(target.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const start = new Date(target.getTime() - 5 * 24 * 3600_000);
  const end = new Date(target.getTime() + 2 * 24 * 3600_000);

  const bars = await fetchBars(symbol, "1Day", start, end);
  const bar = bars.filter((b) => b.t <= target.getTime()).at(-1);

  if (!bar) {
    return NextResponse.json({ error: `No price data found for ${symbol} around ${date}` }, { status: 404 });
  }

  return NextResponse.json({ price: bar.v });
}
