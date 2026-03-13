"use client";

import { useQuery } from "@tanstack/react-query";
import { getTransactions } from "@/lib/api";
import type { AccountTransactionType } from "@/types";

export function useTransactions(types?: AccountTransactionType[]) {
  return useQuery({
    queryKey: ["portfolio", "transactions", types?.sort().join(",") ?? "all"],
    queryFn: () => getTransactions(types),
  });
}
