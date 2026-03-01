"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { placeOrder } from "@/lib/api";
import { SUPPORTED_STOCKS, type SupportedSymbol } from "@/lib/constants";
import type { StockQuote } from "@/types";
import { clsx } from "clsx";

function formatPrice(n: number) {
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
  onClose: () => void;
};

export function OrderModal({ symbol, quote, onClose }: Props) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const queryClient = useQueryClient();

  const mutate = useMutation({
    mutationFn: placeOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio", "positions"] });
      queryClient.invalidateQueries({ queryKey: ["stocks", "quotes"] });
      onClose();
    },
  });

  const name = SUPPORTED_STOCKS.find((s) => s.symbol === symbol)?.name ?? symbol;
  const price = quote?.price ?? 0;
  const q = parseInt(quantity, 10) || 0;
  const total = price * q;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity || q <= 0) return;
    mutate.mutate({ symbol, side, quantity: q, orderType: "market" });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Place order"
    >
      <div
        className="w-full max-w-md bg-rh-card border border-rh-border rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-rh-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-rh-white">Trade {symbol}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-rh-muted hover:text-rh-white rounded-lg transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-rh-muted">{name}</p>
          <p className="text-2xl font-mono font-semibold text-rh-white mt-1">
            {formatPrice(price)}
          </p>
          {quote && (
            <p
              className={clsx(
                "text-sm font-medium mt-0.5",
                quote.change >= 0 ? "text-rh-green" : "text-rh-red"
              )}
            >
              {quote.change >= 0 ? "+" : ""}
              {quote.change.toFixed(2)} (
              {quote.changePercent >= 0 ? "+" : ""}
              {quote.changePercent.toFixed(2)}%) today
            </p>
          )}
        </div>

        <div className="px-4 flex rounded-lg overflow-hidden bg-rh-black border border-rh-border p-1">
          <button
            type="button"
            onClick={() => setSide("buy")}
            className={clsx(
              "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
              side === "buy"
                ? "bg-rh-green text-rh-black"
                : "text-rh-muted hover:text-rh-white"
            )}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setSide("sell")}
            className={clsx(
              "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
              side === "sell"
                ? "bg-rh-red text-white"
                : "text-rh-muted hover:text-rh-white"
            )}
          >
            Sell
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="quantity" className="block text-sm text-rh-muted mb-1">
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/\D/g, "").slice(0, 8))}
              className="w-full bg-rh-black border border-rh-border rounded-xl px-4 py-3 text-rh-white font-mono text-lg focus:outline-none focus:ring-2 focus:ring-rh-green focus:border-transparent"
              placeholder="0"
            />
          </div>
          {q > 0 && (
            <p className="text-sm text-rh-muted">
              Total: <span className="font-mono text-rh-white">{formatPrice(total)}</span>
            </p>
          )}
          <button
            type="submit"
            disabled={!quantity || q <= 0 || mutate.isPending}
            className={clsx(
              "w-full py-3 rounded-xl font-semibold text-white transition-opacity disabled:opacity-50",
              side === "buy" ? "bg-rh-green text-rh-black" : "bg-rh-red"
            )}
          >
            {mutate.isPending
              ? "Placing…"
              : side === "buy"
                ? `Buy ${symbol}`
                : `Sell ${symbol}`}
          </button>
          {mutate.isError && (
            <p className="text-sm text-rh-red">
              {mutate.error instanceof Error ? mutate.error.message : "Order failed"}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
