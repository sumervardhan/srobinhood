/**
 * API client for the Robinhood frontend.
 * All endpoints can be backed by your data pipeline (parquet, DB, webhooks).
 * Replace fetch URLs or add BFF routes that read from your pipeline.
 */

import type { OrderRequest, Order, Position, StockQuote } from "@/types";

const BASE = typeof window === "undefined" ? "" : "";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json() as Promise<T>;
}

export async function getQuotes(): Promise<StockQuote[]> {
  return api<StockQuote[]>("/api/stocks/quotes");
}

export async function getPositions(): Promise<Position[]> {
  return api<Position[]>("/api/portfolio/positions");
}

export async function placeOrder(body: OrderRequest): Promise<Order> {
  return api<Order>("/api/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
