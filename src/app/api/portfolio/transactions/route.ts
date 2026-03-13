export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type TransactionType = "deposit" | "withdrawal" | "buy" | "sell";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const typesParam = searchParams.get("types"); // comma-separated: deposit,withdrawal,buy,sell
  const validTypes: TransactionType[] = ["deposit", "withdrawal", "buy", "sell"];
  const filterTypes: TransactionType[] = typesParam
    ? (typesParam.split(",").map((t) => t.trim()) as TransactionType[]).filter((t) =>
        validTypes.includes(t)
      )
    : validTypes;

  const transactions = await prisma.accountTransaction.findMany({
    where: {
      userId,
      ...(filterTypes.length > 0 && filterTypes.length < validTypes.length
        ? { type: { in: filterTypes } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const list = transactions.map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    symbol: t.symbol ?? undefined,
    orderId: t.orderId ?? undefined,
    createdAt: t.createdAt.toISOString(),
  }));

  return NextResponse.json({ transactions: list });
}
