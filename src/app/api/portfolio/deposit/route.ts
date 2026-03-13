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

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: session.user?.email ?? undefined,
        name: session.user?.name ?? undefined,
        image: session.user?.image ?? undefined,
        spendingPower: amount,
      },
      update: { spendingPower: { increment: amount } },
    });
    await tx.accountTransaction.create({
      data: { userId, type: "deposit", amount },
    });
    return user;
  });

  return NextResponse.json({ spendingPower: updated.spendingPower });
}
