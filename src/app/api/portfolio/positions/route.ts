export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getQuotesServer } from "@/lib/quotes-server";
import { STOCK_SYMBOLS } from "@/lib/constants";
import type { Position } from "@/types";

function buildPositions(
  rows: { symbol: string; quantity: number; averageCost: number }[],
  quotes: { symbol: string; price: number }[]
): Position[] {
  return rows
    .filter((r) => (STOCK_SYMBOLS as readonly string[]).includes(r.symbol))
    .map((row) => {
      const price = quotes.find((q) => q.symbol === row.symbol)?.price ?? row.averageCost;
      const marketValue = row.quantity * price;
      const totalCost = row.quantity * row.averageCost;
      const gainLoss = marketValue - totalCost;
      const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;
      return {
        symbol: row.symbol as Position["symbol"],
        quantity: row.quantity,
        averageCost: row.averageCost,
        currentPrice: price,
        marketValue,
        totalCost,
        gainLoss,
        gainLossPercent,
      };
    });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json([]);
  }
  const userId = session.user.id;
  try {
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
        image: session.user.image ?? undefined,
      },
      update: {},
    });
  } catch {
    // DB may not be set up yet
    return NextResponse.json([]);
  }
  const rows = await prisma.position.findMany({
    where: { userId },
    select: { symbol: true, quantity: true, averageCost: true },
  });
  const quotes = await getQuotesServer();
  const positions = buildPositions(
    rows.map((r) => ({ symbol: r.symbol, quantity: r.quantity, averageCost: r.averageCost })),
    quotes.map((q) => ({ symbol: q.symbol, price: q.price }))
  );
  return NextResponse.json(positions);
}
