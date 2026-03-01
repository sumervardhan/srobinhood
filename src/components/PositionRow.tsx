"use client";

import type { Position } from "@/types";
import { clsx } from "clsx";

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPercent(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

type Props = {
  position: Position;
  onTrade: (symbol: Position["symbol"]) => void;
};

export function PositionRow({ position, onTrade }: Props) {
  const isUp = position.gainLoss >= 0;

  return (
    <div
      className="flex items-center justify-between py-3 px-4 rounded-xl bg-rh-card border border-rh-border hover:border-rh-muted/40 transition-colors cursor-pointer"
      onClick={() => onTrade(position.symbol)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTrade(position.symbol);
        }
      }}
    >
      <div>
        <div className="font-semibold text-rh-white">{position.symbol}</div>
        <div className="text-sm text-rh-muted">
          {position.quantity} share{position.quantity !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-rh-white">{formatMoney(position.marketValue)}</div>
        <div
          className={clsx(
            "text-sm font-medium",
            isUp ? "text-rh-green" : "text-rh-red"
          )}
        >
          {formatPercent(position.gainLossPercent)} today
        </div>
      </div>
    </div>
  );
}
