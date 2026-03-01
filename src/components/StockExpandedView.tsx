"use client";

import { StockChart } from "./StockChart";
import type { Position } from "@/types";
import type { StockQuote } from "@/types";
import type { SupportedSymbol } from "@/lib/constants";

function formatQuantity(q: number) {
  return Number.isInteger(q) ? q : q < 1 ? q.toFixed(4) : q.toFixed(2);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

type Props = {
  symbol: SupportedSymbol;
  quote: StockQuote | undefined;
  position: Position | undefined;
  onBuy: () => void;
  onSell: () => void;
};

export function StockExpandedView({ symbol, quote, position, onBuy, onSell }: Props) {
  return (
    <div className="pt-2 pb-4 px-4 space-y-4 -mt-2 rounded-b-xl border-x border-b border-rh-border bg-rh-card/30">
      <StockChart symbol={symbol} />

      <div className="flex flex-col gap-3">
        {position ? (
          <div className="rounded-lg bg-rh-black/50 border border-rh-border p-3">
            <p className="text-xs text-rh-muted mb-1">Your position</p>
            <p className="font-medium text-rh-white">
              {formatQuantity(position.quantity)} share{position.quantity !== 1 ? "s" : ""} · Avg cost {formatMoney(position.averageCost)}
            </p>
            <p className="text-sm text-rh-muted">
              Market value {formatMoney(position.marketValue)}
              <span className={position.gainLoss >= 0 ? "text-rh-green" : "text-rh-red"}>
                {" "}({position.gainLoss >= 0 ? "+" : ""}{position.gainLossPercent.toFixed(2)}%)
              </span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-rh-muted">No position in {symbol}</p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBuy}
            className="flex-1 py-2.5 rounded-xl bg-rh-green text-rh-black font-semibold hover:bg-green-400 transition-colors"
          >
            Buy
          </button>
          <button
            type="button"
            onClick={onSell}
            className="flex-1 py-2.5 rounded-xl bg-rh-red text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!position || position.quantity <= 0}
          >
            Sell
          </button>
        </div>
      </div>
    </div>
  );
}
