"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TimeRangeToggle } from "./TimeRangeToggle";
import { AnimatedPrice } from "./AnimatedPrice";
import { formatTime, computeTicks, DAY_MS } from "@/lib/chart-utils";
import { getPortfolioChart } from "@/lib/api";
import type { ChartRange } from "@/lib/chart-ranges";

function formatValue(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

function formatAxisTick(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}k`;
  return `$${v.toFixed(0)}`;
}

type Props = {
  /** Live portfolio value computed from positions × current prices. Used for the header. */
  liveValue?: number;
};

export function PortfolioChart({ liveValue }: Props) {
  const [range, setRange] = useState<ChartRange>("1M");

  const { data: chartData } = useQuery({
    queryKey: ["portfolio", "chart", range],
    queryFn: () => getPortfolioChart(range),
    select: (res) =>
      (res.series ?? []).map((p) => ({ t: p.t, value: p.v, full: p.v })),
  });

  const data = chartData ?? [];

  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-rh-card border border-rh-border p-6 mb-6 text-center">
        <p className="text-rh-muted text-sm">Add positions to see portfolio performance.</p>
      </div>
    );
  }

  // Use live value for header if available; fall back to last chart point
  const displayValue = liveValue ?? data[data.length - 1]?.full ?? 0;
  const first = data[0]?.full ?? 0;
  const change = displayValue - first;
  const changePct = first > 0 ? (change / first) * 100 : 0;
  const isUp = change >= 0;
  const color = isUp ? "#00c805" : "#f6465d";
  const spanMs = data.length > 1 ? (data[data.length - 1]!.t - data[0]!.t) : DAY_MS;
  const ticks = computeTicks(data);

  return (
    <div className="rounded-xl bg-rh-card border border-rh-border p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-rh-white">Portfolio Value</h3>
          <AnimatedPrice value={displayValue} className="text-xl font-semibold text-rh-white" />
          <p className={clsx("text-sm font-medium", isUp ? "text-rh-green" : "text-rh-red")}>
            {isUp ? "+" : ""}{formatValue(change)} ({(isUp ? "+" : "")}{changePct.toFixed(2)}%)
          </p>
        </div>
        <TimeRangeToggle value={range} onChange={setRange} />
      </div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fill: "#8a8a8a", fontSize: 10 }}
              ticks={ticks}
              tickFormatter={(ts) => formatTime(ts, spanMs)}
            />
            <YAxis
              tick={{ fill: "#8a8a8a", fontSize: 10 }}
              tickFormatter={(v) => formatAxisTick(v)}
              domain={["auto", "auto"]}
            />
            <Tooltip
              formatter={(v: number) => [formatValue(v), "Value"]}
              labelFormatter={(ts) => (typeof ts === "number" ? formatTime(ts, spanMs) : String(ts))}
              contentStyle={{ backgroundColor: "#161616", border: "1px solid #2a2a2a", borderRadius: "8px" }}
              labelStyle={{ color: "#8a8a8a" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill="url(#portfolioGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
