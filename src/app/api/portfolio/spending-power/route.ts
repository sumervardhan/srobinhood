import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { spendingPower: true },
  });
  const spendingPower = user?.spendingPower ?? 0;
  return NextResponse.json({ spendingPower });
}
