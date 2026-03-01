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

type Point = { t: number; v: number };

function formatTime(t: number, range: string) {
  const d = new Date(t);
  if (range === "1D" || range === "5D") return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (range === "1M" || range === "3M") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function formatValue(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

export function PortfolioChart() {
  const [range, setRange] = useState<ChartRange>("1M");
  const [data, setData] = useState<{ time: string; value: number; full: number }[]>([]);

  useEffect(() => {
    fetch(`/api/portfolio/chart?range=${range}`)
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
  }, [range]);

  if (data.length === 0) {
    return (
      <div className="rounded-xl bg-rh-card border border-rh-border p-6 mb-6 text-center">
        <p className="text-rh-muted text-sm">Add positions to see portfolio performance.</p>
      </div>
    );
  }

  const first = data[0]?.full ?? 0;
  const last = data[data.length - 1]?.full ?? 0;
  const change = last - first;
  const changePct = first > 0 ? (change / first) * 100 : 0;
  const isUp = change >= 0;

  return (
    <div className="rounded-xl bg-rh-card border border-rh-border p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm text-rh-muted">Portfolio Value</h3>
          <p className="text-xl font-semibold text-rh-white">{formatValue(last)}</p>
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
                <stop offset="0%" stopColor="#00c805" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#00c805" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="time" tick={{ fill: "#8a8a8a", fontSize: 10 }} />
            <YAxis
              tick={{ fill: "#8a8a8a", fontSize: 10 }}
              tickFormatter={(v) => formatValue(v)}
              domain={["auto", "auto"]}
            />
            <Tooltip
              formatter={(v: number) => [formatValue(v), "Value"]}
              labelFormatter={(label) => label}
              contentStyle={{ backgroundColor: "#161616", border: "1px solid #2a2a2a", borderRadius: "8px" }}
              labelStyle={{ color: "#8a8a8a" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#00c805"
              strokeWidth={2}
              fill="url(#portfolioGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
