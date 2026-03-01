/**
 * Portfolio value over time. Replace with your pipeline.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

    const quotes = getQuotesServer();
    const now = Date.now();
    const ms = RANGE_MS[range] ?? RANGE_MS["1M"];
    const start = now - ms;
    const points = range === "1D" ? 24 : range === "5D" ? 30 : 60;
    const step = ms / points;

    const series: { t: number; v: number }[] = [];
    let totalValue = 0;
    for (const p of positions) {
      const q = quotes.find((x) => x.symbol === p.symbol);
      totalValue += p.quantity * (q?.price ?? p.averageCost);
    }

    for (let i = 0; i <= points; i++) {
      const t = start + i * step;
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
