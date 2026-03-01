/**
 * Portfolio value over time.
 * Uses Alpaca historical bars when configured, otherwise simulated data.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchBars, isAlpacaConfigured } from "@/lib/alpaca";
import { getQuotesServer } from "@/lib/quotes-server";

const RANGE_MS: Record<string, number> = {
  "1D": 24 * 60 * 60 * 1000,
  "5D": 5 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "3M": 90 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
  "5Y": 5 * 365 * 24 * 60 * 60 * 1000,
  All: 5 * 365 * 24 * 60 * 60 * 1000,
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ series: [] });
  }

  const url = new URL(req.url);
  const range = url.searchParams.get("range") ?? "1M";

  try {
    const positions = await prisma.position.findMany({
      where: { userId: session.user.id },
      select: { symbol: true, quantity: true, averageCost: true },
    });
    if (positions.length === 0) {
      return NextResponse.json({ series: [] });
    }

    const now = Date.now();
    const ms = RANGE_MS[range] ?? RANGE_MS["1M"];
    const start = new Date(now - ms);
    const end = new Date(now + 60_000);

    if (isAlpacaConfigured()) {
      try {
        const barsBySymbol = new Map<string, { t: number; v: number }[]>();
        for (const pos of positions) {
          const bars = await fetchBars(pos.symbol, "1Day", start, end);
          barsBySymbol.set(pos.symbol, bars);
        }

        const allTimes = new Set<number>();
        barsBySymbol.forEach((bars) => {
          bars.forEach((b) => allTimes.add(b.t));
        });
        const times = Array.from(allTimes).sort((a, b) => a - b);
        if (times.length === 0) throw new Error("No bars");

        const series: { t: number; v: number }[] = [];
        for (const t of times) {
          let value = 0;
          for (const pos of positions) {
            const bars = barsBySymbol.get(pos.symbol) ?? [];
            const beforeT = bars.filter((b) => b.t <= t);
            const latest = beforeT[beforeT.length - 1];
            const price = latest?.v ?? 0;
            if (price > 0) value += pos.quantity * price;
          }
          if (value > 0) series.push({ t, v: Math.round(value * 100) / 100 });
        }

        const quotes = getQuotesServer();
        let currentValue = 0;
        for (const p of positions) {
          const q = quotes.find((x) => x.symbol === p.symbol);
          currentValue += p.quantity * (q?.price ?? p.averageCost);
        }
        if (series.length > 0 && series[series.length - 1]!.t < now) {
          series.push({ t: now, v: Math.round(currentValue * 100) / 100 });
        }

        return NextResponse.json({ series });
      } catch (e) {
        console.warn("[portfolio/chart] Alpaca failed, falling back to mock:", e);
      }
    }

    const quotes = getQuotesServer();
    const startT = now - ms;
    const points = range === "1D" ? 24 : range === "5D" ? 30 : 60;
    const step = ms / points;

    let totalValue = 0;
    for (const p of positions) {
      const q = quotes.find((x) => x.symbol === p.symbol);
      totalValue += p.quantity * (q?.price ?? p.averageCost);
    }

    const series: { t: number; v: number }[] = [];
    for (let i = 0; i <= points; i++) {
      const t = startT + i * step;
      const progress = i / points;
      const v = totalValue * (0.92 + progress * 0.08 * (0.9 + Math.random() * 0.2));
      series.push({ t, v: Math.round(v * 100) / 100 });
    }
    series.push({ t: now, v: totalValue });
    series.sort((a, b) => a.t - b.t);

    return NextResponse.json({ series });
  } catch {
    return NextResponse.json({ series: [] });
  }
}
