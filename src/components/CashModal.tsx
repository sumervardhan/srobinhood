"use client";

import { useState } from "react";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function parseOrderError(error: unknown): string {
  const msg = typeof error === "string" ? error : error instanceof Error ? error.message : "";
  if (!msg) return "Something went wrong.";
  try {
    const parsed = JSON.parse(msg) as { error?: string };
    if (typeof parsed?.error === "string") return parsed.error;
  } catch {
    /* not JSON */
  }
  return msg;
}

type Props = {
  type: "deposit" | "withdraw";
  maxAmount?: number;
  onClose: () => void;
  onSubmit: (amount: number) => void;
  isPending: boolean;
  error?: string;
};

export function CashModal({ type, maxAmount, onClose, onSubmit, isPending, error }: Props) {
  const [inputValue, setInputValue] = useState("");

  const amount = parseFloat(inputValue) || 0;
  const isValid = amount > 0 && (type === "deposit" || (maxAmount !== undefined && amount <= maxAmount));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSubmit(amount);
  };

  const handleInputChange = (value: string) => {
    setInputValue(value.replace(/[^\d.]/g, "").replace(/^(\d*\.)(.*)\./, "$1$2").slice(0, 14));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={type === "deposit" ? "Deposit funds" : "Withdraw funds"}
    >
      <div
        className="w-full max-w-md bg-rh-card border border-rh-border rounded-t-2xl sm:rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-rh-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-rh-white">
            {type === "deposit" ? "Deposit" : "Withdraw"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-rh-muted hover:text-rh-white rounded-lg transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="amount" className="block text-sm text-rh-muted mb-1">
              Amount (USD)
            </label>
            <input
              id="amount"
              type="text"
              inputMode="decimal"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              className="w-full bg-rh-black border border-rh-border rounded-xl px-4 py-3 text-rh-white font-mono text-lg focus:outline-none focus:ring-2 focus:ring-rh-green focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0.00"
              autoFocus
            />
            {maxAmount !== undefined && maxAmount > 0 && (
              <button
                type="button"
                onClick={() => setInputValue(maxAmount.toFixed(2))}
                className="mt-2 text-sm text-rh-green hover:underline"
              >
                Max: {formatCurrency(maxAmount)}
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={!isValid || isPending}
            className="w-full py-3 rounded-xl font-semibold text-white transition-opacity disabled:opacity-50 bg-rh-green text-rh-black"
          >
            {isPending ? "Processing…" : type === "deposit" ? "Deposit" : "Withdraw"}
          </button>

          {error && (
            <p className="text-sm text-rh-red">{parseOrderError(error)}</p>
          )}
        </form>
      </div>
    </div>
  );
}
