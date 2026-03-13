"use client";

import { useQuery } from "@tanstack/react-query";
import { getQuotes } from "@/lib/api";

const QUOTES_KEY = ["stocks", "quotes"];

export function useQuotes() {
  return useQuery({
    queryKey: QUOTES_KEY,
    queryFn: getQuotes,
    refetchInterval: 5000, // Poll every 5s; replace with WebSocket in production
  });
}
