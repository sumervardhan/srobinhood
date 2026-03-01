"use client";

import type { StockQuote } from "@/types";
import { SUPPORTED_STOCKS } from "@/lib/constants";
import { clsx } from "clsx";

type Props = {
  quote: StockQuote;
  onTrade: (symbol: StockQuote["symbol"]) => void;
  /** When set, row click expands instead of opening trade modal. */
  onExpand?: (symbol: StockQuote["symbol"]) => void;
  isExpanded?: boolean;
  /** When set, show Track button (All Stocks). */
  onTrack?: (symbol: StockQuote["symbol"]) => void;
  /** When set, show Untrack button (Tracked Stocks). */
  onUntrack?: (symbol: StockQuote["symbol"]) => void;
  isTracked?: boolean;
};

function formatPrice(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatChange(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}

function formatPercent(n: number) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function StarIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function StockRow({ quote, onTrade, onExpand, isExpanded, onTrack, onUntrack, isTracked }: Props) {
  const name = SUPPORTED_STOCKS.find((s) => s.symbol === quote.symbol)?.name ?? quote.symbol;
  const isUp = quote.change >= 0;

  const handleRowClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-action]")) return;
    if (onExpand) onExpand(quote.symbol);
    else onTrade(quote.symbol);
  };

  return (
    <div
      className={clsx(
        "grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-4 px-4 rounded-xl bg-rh-card border border-rh-border cursor-pointer",
        "hover:border-rh-muted/40 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg",
        isExpanded && "rounded-b-none border-b-0"
      )}
      onClick={handleRowClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if ((e.target as HTMLElement).closest("[data-action]")) return;
          if (onExpand) onExpand(quote.symbol);
          else onTrade(quote.symbol);
        }
      }}
    >
      <div className="min-w-0">
        <div className="font-semibold text-rh-white">{quote.symbol}</div>
        <div className="text-sm text-rh-muted truncate max-w-[200px]">{name}</div>
      </div>
      <div className="flex flex-col items-center justify-center text-center">
        <div className="font-mono text-lg font-semibold text-rh-white">
          {formatPrice(quote.price)}
        </div>
        <div
          className={clsx(
            "text-sm font-medium",
            isUp ? "text-rh-green" : "text-rh-red"
          )}
        >
          {formatChange(quote.change)} ({formatPercent(quote.changePercent)})
        </div>
      </div>
      <div className="flex justify-end items-center gap-1">
        {isExpanded && (
          <span className="text-rh-muted" aria-hidden>
            <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        )}
        {isTracked ? (
          <button
            type="button"
            data-action
            onClick={(e) => { e.stopPropagation(); onUntrack?.(quote.symbol); }}
            className="p-1.5 text-rh-green hover:text-rh-red rounded transition-colors"
            aria-label="Untrack"
          >
            <StarIcon filled />
          </button>
        ) : onTrack ? (
          <button
            type="button"
            data-action
            onClick={(e) => { e.stopPropagation(); onTrack(quote.symbol); }}
            className="p-1.5 text-rh-muted hover:text-rh-green rounded transition-colors"
            aria-label="Track"
          >
            <StarIcon filled={false} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
