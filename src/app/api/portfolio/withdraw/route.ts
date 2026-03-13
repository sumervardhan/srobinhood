export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const amount = typeof body.amount === "number" ? body.amount : 0;
  if (amount <= 0) {
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
  }
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { spendingPower: true },
  });
  const current = user?.spendingPower ?? 0;
  if (current < amount) {
    return NextResponse.json(
      { error: "Insufficient funds to withdraw" },
      { status: 400 }
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: { spendingPower: { decrement: amount } },
    });
    await tx.accountTransaction.create({
      data: { userId, type: "withdrawal", amount },
    });
    return u;
  });

  return NextResponse.json({ spendingPower: updated.spendingPower });
}
