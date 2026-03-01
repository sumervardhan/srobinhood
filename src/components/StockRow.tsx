"use client";

import type { StockQuote } from "@/types";
import { SUPPORTED_STOCKS } from "@/lib/constants";
import { clsx } from "clsx";

type Props = {
  quote: StockQuote;
  onTrade: (symbol: StockQuote["symbol"]) => void;
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

export function StockRow({ quote, onTrade }: Props) {
  const name = SUPPORTED_STOCKS.find((s) => s.symbol === quote.symbol)?.name ?? quote.symbol;
  const isUp = quote.change >= 0;

  return (
    <div
      className={clsx(
        "flex items-center justify-between py-4 px-4 rounded-xl bg-rh-card border border-rh-border hover:border-rh-muted/40 transition-colors",
        "cursor-pointer"
      )}
      onClick={() => onTrade(quote.symbol)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTrade(quote.symbol);
        }
      }}
    >
      <div>
        <div className="font-semibold text-rh-white">{quote.symbol}</div>
        <div className="text-sm text-rh-muted truncate max-w-[200px]">{name}</div>
      </div>
      <div className="text-right">
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
      <div className="text-rh-muted text-sm">Tap to trade</div>
    </div>
  );
}
