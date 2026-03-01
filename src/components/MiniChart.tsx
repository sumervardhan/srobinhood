"use client";

import { useState, useEffect } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import type { SupportedSymbol } from "@/lib/constants";

type Point = { t: number; v: number };

type Props = {
  symbol: SupportedSymbol;
};

export function MiniChart({ symbol }: Props) {
  const [data, setData] = useState<{ value: number }[]>([]);

  useEffect(() => {
    fetch(`/api/stocks/${symbol}/chart?range=1M`)
      .then((r) => r.json())
      .then((res: { series?: Point[] }) => {
        const series = res.series ?? [];
        setData(
          series.map((p, i) => ({
            value: p.v,
            index: i,
          }))
        );
      })
      .catch(() => setData([]));
  }, [symbol]);

  if (data.length === 0) return null;

  const last = data[data.length - 1]?.value ?? 0;
  const first = data[0]?.value ?? last;
  const isUp = last >= first;

  return (
    <div
      className="h-8 w-20 min-w-[80px] shrink-0"
      style={{ viewTransitionName: `chart-${symbol}` } as React.CSSProperties}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`miniGradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isUp ? "#00c805" : "#f6465d"} stopOpacity={0.4} />
              <stop offset="100%" stopColor={isUp ? "#00c805" : "#f6465d"} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={isUp ? "#00c805" : "#f6465d"}
            strokeWidth={1.5}
            fill={`url(#miniGradient-${symbol})`}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
