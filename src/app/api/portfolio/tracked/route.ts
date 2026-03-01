import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { STOCK_SYMBOLS } from "@/lib/constants";
import type { SupportedSymbol } from "@/lib/constants";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ symbols: [] });
  }
  try {
    const rows = await prisma.trackedStock.findMany({
      where: { userId: session.user.id },
      select: { symbol: true },
    });
    const symbols = rows
      .map((r) => r.symbol)
      .filter((s): s is SupportedSymbol => (STOCK_SYMBOLS as readonly string[]).includes(s));
    return NextResponse.json({ symbols });
  } catch {
    return NextResponse.json({ symbols: [] });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { symbol?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const symbol = body.symbol;
  if (!symbol || !(STOCK_SYMBOLS as readonly string[]).includes(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
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
    await prisma.trackedStock.upsert({
      where: { userId_symbol: { userId, symbol } },
      create: { userId, symbol },
      update: {},
    });
    return NextResponse.json({ symbols: [symbol] });
  } catch (e) {
    console.error("Track add failed", e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol");
  if (!symbol || !(STOCK_SYMBOLS as readonly string[]).includes(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }
  try {
    await prisma.trackedStock.deleteMany({
      where: { userId: session.user.id, symbol },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
