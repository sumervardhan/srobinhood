"use client";

import { clsx } from "clsx";
import { CHART_RANGES, type ChartRange } from "@/lib/chart-ranges";

type Props = {
  value: ChartRange;
  onChange: (r: ChartRange) => void;
};

export function TimeRangeToggle({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-rh-black/50 border border-rh-border">
      {CHART_RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={clsx(
            "px-2 py-1 text-xs font-medium rounded transition-colors",
            value === r
              ? "bg-white/15"
              : "text-rh-muted hover:text-rh-white"
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
