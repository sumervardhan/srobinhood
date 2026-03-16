/**
 * Live quotes for supported stocks.
 * Reads from Redis snapshot when available, falls back to live-prices singleton.
 */
import { NextResponse } from "next/server";
import { getQuotesServer } from "@/lib/quotes-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const quotes = await getQuotesServer();
  return NextResponse.json(quotes);
}
