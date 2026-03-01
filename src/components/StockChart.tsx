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
import type { ChartRange } from "@/lib/chart-ranges";
import type { SupportedSymbol } from "@/lib/constants";

type Point = { t: number; v: number };

function formatTime(t: number, range: string) {
  const d = new Date(t);
  if (range === "1D" || range === "5D") return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (range === "1M" || range === "3M") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

type Props = {
  symbol: SupportedSymbol;
};

export function StockChart({ symbol }: Props) {
  const [range, setRange] = useState<ChartRange>("1M");
  const [data, setData] = useState<{ time: string; value: number; full: number }[]>([]);

  useEffect(() => {
    fetch(`/api/stocks/${symbol}/chart?range=${range}`)
      .then((r) => r.json())
      .then((res: { series?: Point[] }) => {
        const series = res.series ?? [];
        setData(
          series.map((p) => ({
            time: formatTime(p.t, range),
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

  return (
    <div className="rounded-xl bg-rh-card/50 border border-rh-border p-4">
      <div className="flex items-center justify-between mb-4">
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
                <stop offset="0%" stopColor="#00c805" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#00c805" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="time" tick={{ fill: "#8a8a8a", fontSize: 10 }} />
            <YAxis
              tick={{ fill: "#8a8a8a", fontSize: 10 }}
              tickFormatter={(v) => `$${v.toFixed(2)}`}
              domain={["auto", "auto"]}
            />
            <Tooltip
              formatter={(v: number) => [`$${v.toFixed(2)}`, "Price"]}
              labelFormatter={(label) => label}
              contentStyle={{ backgroundColor: "#161616", border: "1px solid #2a2a2a", borderRadius: "8px" }}
              labelStyle={{ color: "#8a8a8a" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#00c805"
              strokeWidth={2}
              fill={`url(#stockGradient-${symbol})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
