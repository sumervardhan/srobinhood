"use client";

import { useQuery } from "@tanstack/react-query";
import { getSpendingPower } from "@/lib/api";

export function useSpendingPower() {
  return useQuery({
    queryKey: ["portfolio", "spending-power"],
    queryFn: getSpendingPower,
  });
}
