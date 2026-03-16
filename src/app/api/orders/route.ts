export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPriceForSymbol } from "@/lib/quotes-server";
import { STOCK_SYMBOLS } from "@/lib/constants";
import type { OrderRequest, Order } from "@/types";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: OrderRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { symbol, side, quantity, orderType } = body;
  if (
    !symbol ||
    !STOCK_SYMBOLS.includes(symbol) ||
    (side !== "buy" && side !== "sell") ||
    typeof quantity !== "number" ||
    quantity <= 0 ||
    orderType !== "market"
  ) {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 });
  }

  const userId = session.user.id;
  const filledPrice = await getPriceForSymbol(symbol);

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
  } catch (e) {
    console.error("User upsert failed", e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const qty = Math.round(quantity * 10000) / 10000;
  const totalCost = filledPrice * qty;

  if (side === "sell") {
    const pos = await prisma.position.findUnique({
      where: { userId_symbol: { userId, symbol } },
    });
    if (!pos || pos.quantity < qty - 0.0001) {
      return NextResponse.json({ error: "Insufficient shares to sell" }, { status: 400 });
    }
  } else {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { spendingPower: true },
    });
    const spendingPower = user?.spendingPower ?? 0;
    if (spendingPower < totalCost - 0.01) {
      return NextResponse.json({ error: "Insufficient spending power" }, { status: 400 });
    }
  }

  const order = await prisma.order.create({
    data: {
      userId,
      symbol,
      side,
      quantity: qty,
      filledPrice,
      status: "filled",
    },
  });

  const totalAmount = filledPrice * qty;

  if (side === "buy") {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { spendingPower: { decrement: totalAmount } },
      }),
      prisma.accountTransaction.create({
        data: { userId, type: "buy", amount: totalAmount, symbol, orderId: order.id },
      }),
    ]);
    const existing = await prisma.position.findUnique({
      where: { userId_symbol: { userId, symbol } },
    });
    if (existing) {
      const newQty = Math.round((existing.quantity + qty) * 10000) / 10000;
      const newAvg = (existing.averageCost * existing.quantity + filledPrice * qty) / newQty;
      await prisma.position.update({
        where: { userId_symbol: { userId, symbol } },
        data: { quantity: newQty, averageCost: newAvg },
      });
    } else {
      await prisma.position.create({
        data: { userId, symbol, quantity: qty, averageCost: filledPrice },
      });
    }
  } else {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { spendingPower: { increment: totalAmount } },
      }),
      prisma.accountTransaction.create({
        data: { userId, type: "sell", amount: totalAmount, symbol, orderId: order.id },
      }),
    ]);
    const existing = await prisma.position.findUnique({
      where: { userId_symbol: { userId, symbol } },
    });
    if (!existing) throw new Error("Position missing");
    const newQty = Math.round((existing.quantity - qty) * 10000) / 10000;
    if (newQty <= 0.0001) {
      await prisma.position.delete({
        where: { userId_symbol: { userId, symbol } },
      });
    } else {
      await prisma.position.update({
        where: { userId_symbol: { userId, symbol } },
        data: { quantity: newQty },
      });
    }
  }

  const response: Order = {
    id: order.id,
    symbol: order.symbol as Order["symbol"],
    side: order.side as "buy" | "sell",
    quantity: order.quantity,
    filledPrice: order.filledPrice,
    status: order.status as Order["status"],
    createdAt: order.createdAt.toISOString(),
  };
  return NextResponse.json(response);
}
