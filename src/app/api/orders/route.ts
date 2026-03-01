/**
 * Place buy/sell order at market. Pipeline would validate, execute at live rate, persist to DB.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
  // TODO: get live price from pipeline, execute order, persist
  const filledPrice = 100; // placeholder
  const order: Order = {
    id: `ord_${Date.now()}`,
    symbol: symbol as Order["symbol"],
    side: body.side,
    quantity: body.quantity,
    filledPrice,
    status: "filled",
    createdAt: new Date().toISOString(),
  };
  return NextResponse.json(order);
}
