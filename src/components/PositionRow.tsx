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

function formatQuantity(q: number) {
  return Number.isInteger(q) ? q : q < 1 ? q.toFixed(4) : q.toFixed(2);
}

type Props = {
  position: Position;
  onTrade: (symbol: Position["symbol"]) => void;
  /** When set, row click expands instead of opening trade modal. */
  onExpand?: (symbol: Position["symbol"]) => void;
  isExpanded?: boolean;
};

export function PositionRow({ position, onTrade, onExpand, isExpanded }: Props) {
  const isUp = position.gainLoss >= 0;

  const handleClick = () => {
    if (onExpand) onExpand(position.symbol);
    else onTrade(position.symbol);
  };

  return (
    <div
      className={clsx(
        "grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-3 px-4 rounded-xl bg-rh-card border border-rh-border cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:border-rh-muted/40 hover:shadow-lg",
        isExpanded && "rounded-b-none border-b-0"
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="min-w-0">
        <div className="font-semibold text-rh-white">{position.symbol}</div>
        <div className="text-sm text-rh-muted">
          {formatQuantity(position.quantity)} share{position.quantity !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="flex flex-col items-center justify-center text-center">
        <div className="font-mono text-rh-white">{formatMoney(position.marketValue)}</div>
        <div className={clsx("text-sm font-medium", isUp ? "text-rh-green" : "text-rh-red")}>
          {formatPercent(position.gainLossPercent)} today
        </div>
      </div>
      <div className="flex justify-end">
        {isExpanded && (
          <span className="text-rh-muted" aria-hidden>
            <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}
