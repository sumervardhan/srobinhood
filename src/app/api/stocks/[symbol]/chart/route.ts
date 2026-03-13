/**
 * Historical price data for a stock.
 * Uses Alpaca when configured, otherwise simulated data.
 */
import { NextResponse } from "next/server";
import { fetchBars, isAlpacaConfigured } from "@/lib/alpaca";
import { getPriceForSymbol } from "@/lib/quotes-server";
import { STOCK_SYMBOLS, SUPPORTED_STOCKS } from "@/lib/constants";

const RANGE_MS: Record<string, number> = {
  "1D": 24 * 60 * 60 * 1000,
  "5D": 5 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "3M": 90 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
  "5Y": 5 * 365 * 24 * 60 * 60 * 1000,
  All: 5 * 365 * 24 * 60 * 60 * 1000,
};

function generateMockSeries(symbol: string, range: string): { t: number; v: number }[] {
  const now = Date.now();
  const ms = RANGE_MS[range] ?? RANGE_MS["1M"];
  const start = now - ms;
  const currentPrice = getPriceForSymbol(symbol);
  const basePrice = currentPrice * (0.85 + Math.random() * 0.2);
  const points = range === "1D" ? 24 * 12 : range === "5D" ? 60 : range === "1M" || range === "3M" ? 90 : 120;
  const step = ms / points;
  const series: { t: number; v: number }[] = [];
  let v = basePrice;
  for (let i = 0; i <= points; i++) {
    const t = start + i * step;
    v = v * (1 + (Math.random() - 0.48) * 0.02);
    series.push({ t, v: Math.round(v * 100) / 100 });
  }
  series.push({ t: now, v: currentPrice });
  return series.sort((a, b) => a.t - b.t);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const url = new URL(req.url);
  const range = url.searchParams.get("range") ?? "1M";

  if (!symbol || !(STOCK_SYMBOLS as readonly string[]).includes(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  if (isAlpacaConfigured()) {
    try {
      const now = new Date();
      const ms = RANGE_MS[range] ?? RANGE_MS["1M"];
      const ipoDate = SUPPORTED_STOCKS.find((s) => s.symbol === symbol)?.ipoDate;
      const start = range === "All" && ipoDate
        ? new Date(ipoDate)
        : new Date(now.getTime() - ms);
      const end = new Date(now.getTime() + 60_000);

      const timeframe = range === "1D" ? "1Min" : range === "5D" ? "1Hour" : "1Day";
      const series = await fetchBars(symbol, timeframe, start, end);

      if (series.length > 0) {
        return NextResponse.json({ symbol, range, series });
      }
    } catch (e) {
      console.warn("[chart] Alpaca bars failed, falling back to mock:", e);
    }
  }

  const series = generateMockSeries(symbol, range);
  return NextResponse.json({ symbol, range, series });
}
