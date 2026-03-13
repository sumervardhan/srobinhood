"use client";

import { useState, useMemo } from "react";
import { clsx } from "clsx";
import { useTransactions } from "@/hooks/useTransactions";
import type { AccountTransaction, AccountTransactionType } from "@/types";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const TYPE_LABELS: Record<AccountTransactionType, string> = {
  deposit: "Deposit",
  withdrawal: "Withdraw",
  buy: "Buy",
  sell: "Sell",
};

const FILTER_LABELS: Record<AccountTransactionType, string> = {
  deposit: "Dep",
  withdrawal: "Wthdr",
  buy: "Buy",
  sell: "Sell",
};

const TYPE_COLORS: Record<AccountTransactionType, string> = {
  deposit: "text-rh-green",
  sell: "text-rh-green",
  withdrawal: "text-rh-red",
  buy: "text-rh-red",
};

export function TransactionLog() {
  const [filters, setFilters] = useState<Set<AccountTransactionType>>(
    new Set<AccountTransactionType>(["deposit", "withdrawal", "buy", "sell"])
  );
  const filterArray = useMemo(() => Array.from(filters), [filters]);
  const { data, isLoading } = useTransactions(filterArray.length === 4 ? undefined : filterArray);
  const transactions = data?.transactions ?? [];

  const activityTypes: AccountTransactionType[] = ["deposit", "withdrawal", "buy", "sell"];

  const selectFilter = (t: AccountTransactionType) => {
    const isAllMode = filters.size === activityTypes.length || filters.size === 0;
    if (isAllMode) {
      setFilters(new Set([t]));
    } else {
      setFilters((prev) => {
        const next = new Set(prev);
        if (next.has(t)) {
          next.delete(t);
        } else {
          next.add(t);
        }
        return next;
      });
    }
  };

  const renderRow = (t: AccountTransaction) => (
    <div
      key={t.id}
      className="flex items-center justify-between py-3 border-b border-rh-border last:border-0"
    >
      <div>
        <p className="text-sm font-medium text-rh-white">
          {TYPE_LABELS[t.type]}
          {t.symbol && (
            <span className="text-rh-muted font-normal ml-1">· {t.symbol}</span>
          )}
        </p>
        <p className="text-xs text-rh-muted">{formatDate(t.createdAt)}</p>
      </div>
      <span className={`font-mono font-medium ${TYPE_COLORS[t.type]}`}>
        {["deposit", "sell"].includes(t.type) ? "+" : "-"}
        {formatCurrency(t.amount)}
      </span>
    </div>
  );

  return (
    <div className="rounded-xl bg-rh-card border border-rh-border p-4 flex flex-col min-h-0 flex-1 overflow-hidden">
      <div className="shrink-0 mb-4 w-full">
        <h3 className="text-sm font-medium text-rh-white mb-3">Recent Activity</h3>
        <div className="w-full flex gap-1 p-1 rounded-lg bg-rh-black/50 border border-rh-border flex-nowrap">
          <button
            type="button"
            onClick={() => setFilters(new Set(activityTypes))}
            className={clsx(
              "flex-1 min-w-0 px-1.5 py-0.5 text-xs font-medium rounded transition-all whitespace-nowrap overflow-hidden text-ellipsis",
              filters.size === activityTypes.length || filters.size === 0
                ? "bg-white/15"
                : "text-rh-muted hover:text-rh-white"
            )}
          >
            All
          </button>
          {activityTypes.map((t) => {
            const isAllMode = filters.size === activityTypes.length || filters.size === 0;
            const isSelected = filters.has(t) && !isAllMode;
            return (
              <button
                key={t}
                type="button"
                onClick={() => selectFilter(t)}
                className={clsx(
                  "flex-1 min-w-0 px-1.5 py-0.5 text-xs font-medium rounded transition-all whitespace-nowrap overflow-hidden text-ellipsis",
                  isSelected ? "bg-white/15" : "text-rh-muted hover:text-rh-white"
                )}
              >
                {FILTER_LABELS[t]}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setFilters(new Set(activityTypes))}
            className="flex-1 min-w-0 px-1.5 py-0.5 text-xs font-medium rounded text-rh-muted hover:text-rh-white transition-colors"
            aria-label="Clear filters"
          >
            ✕
          </button>
        </div>
      </div>
      {isLoading ? (
        <p className="text-rh-muted text-sm py-4 shrink-0">Loading…</p>
      ) : transactions.length === 0 ? (
        <p className="text-rh-muted text-sm py-4 shrink-0">No transactions yet.</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">{transactions.map(renderRow)}</div>
      )}
    </div>
  );
}
