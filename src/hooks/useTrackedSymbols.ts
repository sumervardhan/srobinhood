"use client";

import { useQuery } from "@tanstack/react-query";
import type { SupportedSymbol } from "@/lib/constants";

async function getTrackedSymbols(): Promise<SupportedSymbol[]> {
  const res = await fetch("/api/portfolio/tracked", { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.symbols) ? data.symbols : [];
}

const TRACKED_KEY = ["portfolio", "tracked"];

export function useTrackedSymbols() {
  return useQuery({
    queryKey: TRACKED_KEY,
    queryFn: getTrackedSymbols,
  });
}
