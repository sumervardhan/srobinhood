/**
 * POST /api/backtest/trade
 * Insert a backdated buy or sell order.
 *
 * Body: { symbol, side, quantity, date (ISO), price? }
 * If price is omitted, the historical close price is fetched from Alpaca.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchBars, isAlpacaConfigured } from "@/lib/alpaca";
import { reconcileCurrentState } from "@/lib/reconcile";
import { STOCK_SYMBOLS } from "@/lib/constants";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { symbol?: string; side?: string; quantity?: number; date?: string; price?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { symbol, side, quantity, date, price: manualPrice } = body;

  if (
    !symbol ||
    !STOCK_SYMBOLS.includes(symbol as (typeof STOCK_SYMBOLS)[number]) ||
    (side !== "buy" && side !== "sell") ||
    typeof quantity !== "number" ||
    quantity <= 0 ||
    !date
  ) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const tradeDate = new Date(date);
  if (isNaN(tradeDate.getTime()) || tradeDate >= new Date()) {
    return NextResponse.json({ error: "Date must be a valid past date" }, { status: 400 });
  }

  // Resolve price
  let filledPrice = manualPrice;
  if (!filledPrice) {
    if (!isAlpacaConfigured()) {
      return NextResponse.json({ error: "No manual price provided and Alpaca is not configured" }, { status: 400 });
    }
    const start = new Date(tradeDate.getTime() - 3 * 24 * 3600_000);
    const end = new Date(tradeDate.getTime() + 2 * 24 * 3600_000);
    const bars = await fetchBars(symbol, "1Day", start, end);
    const bar = bars.filter((b) => b.t <= tradeDate.getTime()).at(-1);
    if (!bar) {
      return NextResponse.json({ error: `No price data found for ${symbol} on ${date}` }, { status: 400 });
    }
    filledPrice = bar.v;
  }

  const userId = session.user.id;
  const qty = Math.round(quantity * 10000) / 10000;
  const totalAmount = Math.round(filledPrice * qty * 100) / 100;

  try {
    await prisma.$transaction(async (tx) => {
      // Insert the backdated order
      const order = await tx.order.create({
        data: {
          userId,
          symbol,
          side,
          quantity: qty,
          filledPrice,
          status: "filled",
          createdAt: tradeDate,
        },
      });

      // Insert the backdated transaction
      await tx.accountTransaction.create({
        data: {
          userId,
          type: side,
          amount: totalAmount,
          symbol,
          orderId: order.id,
          createdAt: tradeDate,
        },
      });

      // Replay all history to recompute current positions + cash
      await reconcileCurrentState(userId, tx);

      // Purge snapshots on or after the trade date (they're now stale)
      const midnight = new Date(Date.UTC(
        tradeDate.getUTCFullYear(),
        tradeDate.getUTCMonth(),
        tradeDate.getUTCDate(),
      ));
      await tx.portfolioSnapshot.deleteMany({
        where: { userId, date: { gte: midnight } },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
