/**
 * API client for the Robinhood frontend.
 * All endpoints can be backed by your data pipeline (parquet, DB, webhooks).
 * Replace fetch URLs or add BFF routes that read from your pipeline.
 */

import type { OrderRequest, Order, Position, StockQuote, AccountTransaction } from "@/types";
import type { SupportedSymbol } from "@/lib/constants";

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

export async function trackSymbol(symbol: SupportedSymbol): Promise<void> {
  await api("/api/portfolio/tracked", {
    method: "POST",
    body: JSON.stringify({ symbol }),
  });
}

export async function untrackSymbol(symbol: SupportedSymbol): Promise<void> {
  await api(`/api/portfolio/tracked?symbol=${encodeURIComponent(symbol)}`, {
    method: "DELETE",
  });
}

export async function getSpendingPower(): Promise<{ spendingPower: number }> {
  return api<{ spendingPower: number }>("/api/portfolio/spending-power");
}

export async function deposit(amount: number): Promise<{ spendingPower: number }> {
  return api<{ spendingPower: number }>("/api/portfolio/deposit", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export async function withdraw(amount: number): Promise<{ spendingPower: number }> {
  return api<{ spendingPower: number }>("/api/portfolio/withdraw", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export async function getTransactions(types?: string[]): Promise<{ transactions: AccountTransaction[] }> {
  const qs = types?.length ? `?types=${types.join(",")}` : "";
  return api<{ transactions: AccountTransaction[] }>(`/api/portfolio/transactions${qs}`);
}

export async function getPortfolioChart(range: string): Promise<{ series: { t: number; v: number }[] }> {
  return api<{ series: { t: number; v: number }[] }>(`/api/portfolio/chart?range=${range}`);
}
