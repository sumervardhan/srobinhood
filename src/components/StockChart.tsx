"use client";

import { useState, useEffect } from "react";
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
import { formatTime, computeTicks, DAY_MS } from "@/lib/chart-utils";
import type { ChartRange } from "@/lib/chart-ranges";
import type { SupportedSymbol } from "@/lib/constants";

type Point = { t: number; v: number };

type Props = {
  symbol: SupportedSymbol;
};

export function StockChart({ symbol }: Props) {
  const [range, setRange] = useState<ChartRange>("1M");
  const [data, setData] = useState<{ t: number; value: number; full: number }[]>([]);

  useEffect(() => {
    fetch(`/api/stocks/${symbol}/chart?range=${range}`)
      .then((r) => r.json())
      .then((res: { series?: Point[] }) => {
        const series = res.series ?? [];
        setData(
          series.map((p) => ({
            t: p.t,
            value: p.v,
            full: p.v,
          }))
        );
      })
      .catch(() => setData([]));
  }, [symbol, range]);

  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-rh-card/50 border border-rh-border p-4 h-[200px] flex items-center justify-center">
        <p className="text-rh-muted text-sm">Loading chart…</p>
      </div>
    );
  }

  const first = data[0]?.full ?? 0;
  const last = data[data.length - 1]?.full ?? 0;
  const change = last - first;
  const changePct = first > 0 ? (change / first) * 100 : 0;
  const isUp = change >= 0;
  const color = isUp ? "#00c805" : "#f6465d";
  const spanMs = data.length > 1 ? (data[data.length - 1]!.t - data[0]!.t) : DAY_MS;
  const ticks = computeTicks(data);

  return (
    <div
      className="rounded-xl bg-rh-card/50 border border-rh-border p-4"
      style={{ viewTransitionName: `chart-${symbol}` } as React.CSSProperties}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-lg font-semibold text-rh-white">
            ${last.toFixed(2)}
          </p>
          <p className={clsx("text-sm font-medium", isUp ? "text-rh-green" : "text-rh-red")}>
            {(isUp ? "+" : "")}{change.toFixed(2)} ({(isUp ? "+" : "")}{changePct.toFixed(2)}%)
          </p>
        </div>
        <TimeRangeToggle value={range} onChange={setRange} />
      </div>
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id={`stockGradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
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
              tickFormatter={(v) => `$${v.toFixed(2)}`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              formatter={(v: number) => [`$${v.toFixed(2)}`, "Price"]}
              labelFormatter={(ts) => (typeof ts === "number" ? formatTime(ts, spanMs) : String(ts))}
              contentStyle={{ backgroundColor: "#161616", border: "1px solid #2a2a2a", borderRadius: "8px" }}
              labelStyle={{ color: "#8a8a8a" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#stockGradient-${symbol})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
