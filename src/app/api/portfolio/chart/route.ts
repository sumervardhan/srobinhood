export const dynamic = 'force-dynamic';

/**
 * Portfolio value over time.
 *
 * Portfolio value = stock value + cash (spending power).
 * This means buying stock is a zero-sum reallocation: cash ↓, stocks ↑, total unchanged.
 *
 * Strategy:
 * - Past calendar days → read from PortfolioSnapshot table (computed once, stored forever)
 * - Missing past days  → compute via order history + Alpaca bars + cash history, then upsert
 * - Today              → always computed live from current quotes + current spending power
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

/** Normalise a timestamp to midnight UTC of its calendar day */
function toMidnightUTC(ts: number): Date {
  const d = new Date(ts);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ series: [] });
  }

  const url = new URL(req.url);
  const range = url.searchParams.get("range") ?? "1M";

  try {
    const [orders, txns, user] = await Promise.all([
      prisma.order.findMany({
        where: { userId: session.user.id, status: "filled" },
        orderBy: { createdAt: "asc" },
        select: { symbol: true, side: true, quantity: true, filledPrice: true, createdAt: true },
      }),
      prisma.accountTransaction.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
        select: { type: true, amount: true, createdAt: true },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { spendingPower: true },
      }),
    ]);

    if (orders.length === 0) return NextResponse.json({ series: [] });

    const now = Date.now();
    const ms = RANGE_MS[range] ?? RANGE_MS["1M"];
    const portfolioStartMs = orders[0]!.createdAt.getTime();
    const rangeStartMs = range === "All" ? portfolioStartMs : Math.max(now - ms, portfolioStartMs);

    const symbols = [...new Set(orders.map((o) => o.symbol))];
    const currentCash = user?.spendingPower ?? 0;

    /** Stock quantities held at timestamp t */
    function positionsAt(t: number): Map<string, number> {
      const map = new Map<string, number>();
      for (const o of orders) {
        if (o.createdAt.getTime() > t) break;
        const prev = map.get(o.symbol) ?? 0;
        map.set(o.symbol, o.side === "buy" ? prev + o.quantity : prev - o.quantity);
      }
      map.forEach((qty, sym) => { if (qty <= 0) map.delete(sym); });
      return map;
    }

    /**
     * Cash (spending power) at timestamp t, reconstructed from AccountTransaction history.
     * deposit/sell → +amount, withdrawal/buy → -amount
     */
    function cashAt(t: number): number {
      let cash = 0;
      for (const tx of txns) {
        if (tx.createdAt.getTime() > t) break;
        if (tx.type === "deposit" || tx.type === "sell") cash += tx.amount;
        else if (tx.type === "withdrawal" || tx.type === "buy") cash -= tx.amount;
      }
      return Math.max(0, cash);
    }

    // ── 1D range: skip snapshot cache, return intraday bars + cash ────────────
    if (range === "1D" && isAlpacaConfigured()) {
      try {
        const start = new Date(now - 24 * 60 * 60 * 1000);
        const end = new Date(now + 60_000);
        const barsBySymbol = new Map<string, { t: number; v: number }[]>();
        for (const sym of symbols) {
          barsBySymbol.set(sym, await fetchBars(sym, "1Min", start, end));
        }
        const allTimes = [...new Set([...barsBySymbol.values()].flatMap((b) => b.map((x) => x.t)))].sort((a, b) => a - b);
        const series: { t: number; v: number }[] = [];
        for (const t of allTimes) {
          const held = positionsAt(t);
          if (held.size === 0 && cashAt(t) === 0) continue;
          let stockValue = 0;
          for (const [sym, qty] of held) {
            const latest = (barsBySymbol.get(sym) ?? []).filter((b) => b.t <= t).at(-1);
            if (latest?.v) stockValue += qty * latest.v;
          }
          const total = stockValue + cashAt(t);
          if (total > 0) series.push({ t, v: Math.round(total * 100) / 100 });
        }
        const quotes = getQuotesServer();
        const currentHeld = positionsAt(now);
        let stockValue = 0;
        for (const [sym, qty] of currentHeld) {
          const q = quotes.find((x) => x.symbol === sym);
          const fallback = [...orders].reverse().find((o) => o.symbol === sym)?.filledPrice ?? 0;
          stockValue += qty * (q?.price ?? fallback);
        }
        const currentTotal = stockValue + currentCash;
        if (series.length > 0 && currentTotal > 0) series.push({ t: now, v: Math.round(currentTotal * 100) / 100 });
        return NextResponse.json({ series });
      } catch (e) {
        console.warn("[portfolio/chart] 1D Alpaca failed:", e);
        return NextResponse.json({ series: [] });
      }
    }

    // ── Multi-day ranges: use snapshot cache ──────────────────────────────────
    const existingSnapshots = await prisma.portfolioSnapshot.findMany({
      where: { userId: session.user.id, date: { gte: new Date(rangeStartMs) } },
      orderBy: { date: "asc" },
    });
    const snapshotMap = new Map(existingSnapshots.map((s) => [s.date.getTime(), s.value]));

    const todayMidnight = toMidnightUTC(now).getTime();
    const missingDates: Date[] = [];

    if (isAlpacaConfigured()) {
      let cursor = toMidnightUTC(rangeStartMs).getTime();
      while (cursor < todayMidnight) {
        const eod = cursor + 20 * 3600_000;
        if (!snapshotMap.has(cursor) && (positionsAt(eod).size > 0 || cashAt(eod) > 0)) {
          missingDates.push(new Date(cursor));
        }
        cursor += 24 * 60 * 60 * 1000;
      }
    }

    if (missingDates.length > 0 && isAlpacaConfigured()) {
      try {
        const batchStart = missingDates[0]!;
        const batchEnd = new Date(todayMidnight);
        const barsBySymbol = new Map<string, { t: number; v: number }[]>();
        for (const sym of symbols) {
          barsBySymbol.set(sym, await fetchBars(sym, "1Day", batchStart, batchEnd));
        }

        const toUpsert: { userId: string; date: Date; value: number }[] = [];
        for (const date of missingDates) {
          const t = date.getTime() + 20 * 3600_000; // end-of-trading-day proxy
          const held = positionsAt(t);
          let stockValue = 0;
          for (const [sym, qty] of held) {
            const latest = (barsBySymbol.get(sym) ?? []).filter((b) => b.t <= t).at(-1);
            if (latest?.v) stockValue += qty * latest.v;
          }
          const total = stockValue + cashAt(t);
          if (total > 0) {
            const rounded = Math.round(total * 100) / 100;
            toUpsert.push({ userId: session.user.id, date, value: rounded });
            snapshotMap.set(date.getTime(), rounded);
          }
        }

        if (toUpsert.length > 0) {
          await Promise.all(
            toUpsert.map((s) =>
              prisma.portfolioSnapshot.upsert({
                where: { userId_date: { userId: s.userId, date: s.date } },
                create: s,
                update: { value: s.value },
              })
            )
          );
        }
      } catch (e) {
        console.warn("[portfolio/chart] Failed to compute missing snapshots:", e);
      }
    }

    // ── Build series from snapshot cache + live today ─────────────────────────
    const quotes = getQuotesServer();
    const currentHeld = positionsAt(now);
    let currentStockValue = 0;
    for (const [sym, qty] of currentHeld) {
      const q = quotes.find((x) => x.symbol === sym);
      const fallback = [...orders].reverse().find((o) => o.symbol === sym)?.filledPrice ?? 0;
      currentStockValue += qty * (q?.price ?? fallback);
    }
    const currentTotal = currentStockValue + currentCash;

    const series: { t: number; v: number }[] = [];
    for (const [ts, value] of [...snapshotMap.entries()].sort((a, b) => a[0] - b[0])) {
      if (ts >= rangeStartMs) series.push({ t: ts, v: value });
    }
    if (currentTotal > 0) series.push({ t: now, v: Math.round(currentTotal * 100) / 100 });

    if (series.length > 0) return NextResponse.json({ series });

    // ── Simulated fallback (no Alpaca) ────────────────────────────────────────
    const startT = rangeStartMs;
    const actualMs = now - startT;
    const points = range === "5D" ? 30 : 60;
    const step = actualMs / points;
    const simSeries: { t: number; v: number }[] = [];
    for (let i = 0; i <= points; i++) {
      const t = startT + i * step;
      const cash = cashAt(t);
      if (positionsAt(t).size === 0 && cash === 0) continue;
      const progress = i / points;
      const v = currentTotal * (0.92 + progress * 0.08 * (0.9 + Math.random() * 0.2));
      simSeries.push({ t, v: Math.round(v * 100) / 100 });
    }
    simSeries.push({ t: now, v: currentTotal });
    simSeries.sort((a, b) => a.t - b.t);
    return NextResponse.json({ series: simSeries });
  } catch {
    return NextResponse.json({ series: [] });
  }
}
