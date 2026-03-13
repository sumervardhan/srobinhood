/**
 * POST /api/backtest/cash
 * Insert a backdated deposit or withdrawal.
 *
 * Body: { type: "deposit" | "withdrawal", amount, date (ISO) }
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reconcileCurrentState } from "@/lib/reconcile";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { type?: string; amount?: number; date?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, amount, date } = body;

  if (
    (type !== "deposit" && type !== "withdrawal") ||
    typeof amount !== "number" ||
    amount <= 0 ||
    !date
  ) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const txDate = new Date(date);
  if (isNaN(txDate.getTime()) || txDate >= new Date()) {
    return NextResponse.json({ error: "Date must be a valid past date" }, { status: 400 });
  }

  const userId = session.user.id;
  const rounded = Math.round(amount * 100) / 100;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.accountTransaction.create({
        data: {
          userId,
          type,
          amount: rounded,
          createdAt: txDate,
        },
      });

      await reconcileCurrentState(userId, tx);

      const midnight = new Date(Date.UTC(
        txDate.getUTCFullYear(),
        txDate.getUTCMonth(),
        txDate.getUTCDate(),
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
