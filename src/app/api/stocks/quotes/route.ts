/**
 * Live quotes for supported stocks.
 * Uses live-prices (simulated stream). Replace with your data pipeline when ready.
 */
import { NextResponse } from "next/server";
import { getLiveQuotes } from "@/lib/live-prices";

export const dynamic = "force-dynamic";

export async function GET() {
  const quotes = getLiveQuotes();
  return NextResponse.json(quotes);
}
