/**
 * GET /api/backtest/events
 * Returns all orders and account transactions sorted chronologically.
 * Used to render the backtest event log in the UI.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type BacktestEvent =
  | { kind: "trade"; id: string; date: string; symbol: string; side: "buy" | "sell"; quantity: number; price: number; total: number }
  | { kind: "cash"; id: string; date: string; type: "deposit" | "withdrawal"; amount: number };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ events: [] });
  }

  const [orders, txns] = await Promise.all([
    prisma.order.findMany({
      where: { userId: session.user.id, status: "filled" },
      orderBy: { createdAt: "asc" },
      select: { id: true, symbol: true, side: true, quantity: true, filledPrice: true, createdAt: true },
    }),
    prisma.accountTransaction.findMany({
      where: { userId: session.user.id, type: { in: ["deposit", "withdrawal"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, type: true, amount: true, createdAt: true },
    }),
  ]);

  const events: BacktestEvent[] = [
    ...orders.map((o) => ({
      kind: "trade" as const,
      id: o.id,
      date: o.createdAt.toISOString(),
      symbol: o.symbol,
      side: o.side as "buy" | "sell",
      quantity: o.quantity,
      price: o.filledPrice,
      total: Math.round(o.quantity * o.filledPrice * 100) / 100,
    })),
    ...txns.map((t) => ({
      kind: "cash" as const,
      id: t.id,
      date: t.createdAt.toISOString(),
      type: t.type as "deposit" | "withdrawal",
      amount: t.amount,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return NextResponse.json({ events });
}
