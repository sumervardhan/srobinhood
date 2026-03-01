"use client";

import { useQuery } from "@tanstack/react-query";
import { getPositions } from "@/lib/api";

const POSITIONS_KEY = ["portfolio", "positions"];

export function usePositions() {
  return useQuery({
    queryKey: POSITIONS_KEY,
    queryFn: getPositions,
    refetchInterval: 10000,
  });
}
