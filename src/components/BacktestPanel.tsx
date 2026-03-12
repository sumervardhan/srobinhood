"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { SUPPORTED_STOCKS } from "@/lib/constants";
import type { SupportedSymbol } from "@/lib/constants";
import type { BacktestEvent } from "@/app/api/backtest/events/route";

type Mode = "trade" | "cash";

const today = new Date();
const todayStr = today.toISOString().slice(0, 10);
const defaultDate = new Date(today.getTime() - 30 * 24 * 3600_000).toISOString().slice(0, 10);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

export function BacktestPanel() {
  const queryClient = useQueryClient();

  // Form state
  const [mode, setMode] = useState<Mode>("trade");
  const [symbol, setSymbol] = useState<SupportedSymbol>(SUPPORTED_STOCKS[0].symbol);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [manualPrice, setManualPrice] = useState("");
  const [fetchedPrice, setFetchedPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  const [cashType, setCashType] = useState<"deposit" | "withdrawal">("deposit");
  const [cashAmount, setCashAmount] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Event log
  const [events, setEvents] = useState<BacktestEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await fetch("/api/backtest/events");
      const data = await res.json() as { events: BacktestEvent[] };
      setEvents(data.events ?? []);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Auto-fetch historical price when symbol or date changes
  useEffect(() => {
    if (mode !== "trade" || !date || !symbol) return;
    setFetchedPrice(null);
    setManualPrice("");
    let cancelled = false;
    setPriceLoading(true);
    fetch(`/api/backtest/price?symbol=${symbol}&date=${date}`)
      .then((r) => r.json())
      .then((d: { price?: number; error?: string }) => {
        if (!cancelled) setFetchedPrice(d.price ?? null);
      })
      .catch(() => { if (!cancelled) setFetchedPrice(null); })
      .finally(() => { if (!cancelled) setPriceLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, date, mode]);

  const effectivePrice = manualPrice ? parseFloat(manualPrice) : (fetchedPrice ?? null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      if (mode === "trade") {
        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) throw new Error("Enter a valid quantity");
        if (!effectivePrice || effectivePrice <= 0) throw new Error("Price not available — enter manually");

        const res = await fetch("/api/backtest/trade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, side, quantity: qty, date, price: effectivePrice }),
        });
        const data = await res.json() as { ok?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Request failed");
        setSuccess(`${side === "buy" ? "Bought" : "Sold"} ${qty} ${symbol} @ ${formatCurrency(effectivePrice)} on ${formatDate(date + "T12:00:00Z")}`);
        setQuantity("");
      } else {
        const amt = parseFloat(cashAmount);
        if (isNaN(amt) || amt <= 0) throw new Error("Enter a valid amount");

        const res = await fetch("/api/backtest/cash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: cashType, amount: amt, date }),
        });
        const data = await res.json() as { ok?: boolean; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Request failed");
        setSuccess(`${cashType === "deposit" ? "Deposited" : "Withdrew"} ${formatCurrency(amt)} on ${formatDate(date + "T12:00:00Z")}`);
        setCashAmount("");
      }

      // Invalidate queries so Portfolio tab reflects changes
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      await loadEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  const maxDate = new Date(today.getTime() - 24 * 3600_000).toISOString().slice(0, 10);

  return (
    <div className="px-2 space-y-6 pb-6">
      {/* Form card */}
      <div className="rounded-xl bg-rh-card border border-rh-border p-5">
        <h2 className="text-sm font-semibold text-rh-white mb-4">Add Historical Event</h2>

        {/* Mode toggle */}
        <div className="flex gap-1 mb-5 bg-rh-bg rounded-lg p-1 w-fit">
          {(["trade", "cash"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); setSuccess(null); }}
              className={clsx(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                mode === m ? "bg-rh-card text-rh-white" : "text-rh-muted hover:text-rh-white"
              )}
            >
              {m === "trade" ? "Trade" : "Cash"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "trade" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                {/* Symbol */}
                <div>
                  <label className="block text-xs text-rh-muted mb-1">Symbol</label>
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value as SupportedSymbol)}
                    className="w-full bg-rh-bg border border-rh-border rounded-lg px-3 py-2 text-sm text-rh-white focus:outline-none focus:border-rh-green"
                  >
                    {SUPPORTED_STOCKS.map((s) => (
                      <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs text-rh-muted mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    max={maxDate}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-rh-bg border border-rh-border rounded-lg px-3 py-2 text-sm text-rh-white focus:outline-none focus:border-rh-green"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Side */}
                <div>
                  <label className="block text-xs text-rh-muted mb-1">Side</label>
                  <div className="flex gap-1 bg-rh-bg rounded-lg p-1">
                    {(["buy", "sell"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSide(s)}
                        className={clsx(
                          "flex-1 py-1.5 rounded-md text-sm font-medium transition-colors",
                          side === s
                            ? s === "buy" ? "bg-rh-green text-black" : "bg-rh-red text-white"
                            : "text-rh-muted hover:text-rh-white"
                        )}
                      >
                        {s === "buy" ? "Buy" : "Sell"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-xs text-rh-muted mb-1">Quantity (shares)</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="0.0001"
                    step="any"
                    placeholder="0"
                    className="w-full bg-rh-bg border border-rh-border rounded-lg px-3 py-2 text-sm text-rh-white placeholder:text-rh-muted focus:outline-none focus:border-rh-green"
                    required
                  />
                </div>
              </div>

              {/* Price row */}
              <div>
                <label className="block text-xs text-rh-muted mb-1">
                  Price per share
                  {priceLoading && <span className="ml-2 text-rh-muted">fetching…</span>}
                  {!priceLoading && fetchedPrice && !manualPrice && (
                    <span className="ml-2 text-rh-green">historical close</span>
                  )}
                </label>
                <div className="flex gap-2 items-center">
                  <span className="text-rh-muted text-sm">$</span>
                  <input
                    type="number"
                    value={manualPrice || (fetchedPrice ? fetchedPrice.toFixed(2) : "")}
                    onChange={(e) => setManualPrice(e.target.value)}
                    min="0.01"
                    step="any"
                    placeholder={priceLoading ? "Loading…" : "0.00"}
                    className="flex-1 bg-rh-bg border border-rh-border rounded-lg px-3 py-2 text-sm text-rh-white placeholder:text-rh-muted focus:outline-none focus:border-rh-green"
                  />
                  {(manualPrice || fetchedPrice) && parseFloat(quantity) > 0 && effectivePrice && (
                    <span className="text-xs text-rh-muted whitespace-nowrap">
                      = {formatCurrency(parseFloat(quantity) * effectivePrice)}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {/* Type */}
                <div>
                  <label className="block text-xs text-rh-muted mb-1">Type</label>
                  <div className="flex gap-1 bg-rh-bg rounded-lg p-1">
                    {(["deposit", "withdrawal"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setCashType(t)}
                        className={clsx(
                          "flex-1 py-1.5 rounded-md text-sm font-medium transition-colors",
                          cashType === t ? "bg-rh-card text-rh-white" : "text-rh-muted hover:text-rh-white"
                        )}
                      >
                        {t === "deposit" ? "Deposit" : "Withdraw"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs text-rh-muted mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    max={maxDate}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-rh-bg border border-rh-border rounded-lg px-3 py-2 text-sm text-rh-white focus:outline-none focus:border-rh-green"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-rh-muted mb-1">Amount</label>
                <div className="flex gap-2 items-center">
                  <span className="text-rh-muted text-sm">$</span>
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    min="0.01"
                    step="any"
                    placeholder="0.00"
                    className="flex-1 bg-rh-bg border border-rh-border rounded-lg px-3 py-2 text-sm text-rh-white placeholder:text-rh-muted focus:outline-none focus:border-rh-green"
                    required
                  />
                </div>
              </div>
            </>
          )}

          {error && <p className="text-rh-red text-sm">{error}</p>}
          {success && <p className="text-rh-green text-sm">{success}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-rh-green text-black text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? "Processing…" : mode === "trade" ? `${side === "buy" ? "Buy" : "Sell"} ${symbol}` : `${cashType === "deposit" ? "Deposit" : "Withdraw"} Cash`}
          </button>
        </form>
      </div>

      {/* Event log */}
      <div className="rounded-xl bg-rh-card border border-rh-border overflow-hidden">
        <div className="px-5 py-3 border-b border-rh-border">
          <h2 className="text-sm font-semibold text-rh-white">Event History</h2>
        </div>
        {eventsLoading ? (
          <p className="text-rh-muted text-sm px-5 py-4">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-rh-muted text-sm px-5 py-4">No events yet. Add a historical trade or cash event above.</p>
        ) : (
          <div className="divide-y divide-rh-border">
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {event.kind === "trade" ? (
                    <>
                      <span className={clsx(
                        "text-xs font-semibold px-2 py-0.5 rounded",
                        event.side === "buy" ? "bg-rh-green/20 text-rh-green" : "bg-rh-red/20 text-rh-red"
                      )}>
                        {event.side.toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-rh-white font-medium">{event.symbol}</p>
                        <p className="text-xs text-rh-muted">{event.quantity} shares @ {formatCurrency(event.price)}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className={clsx(
                        "text-xs font-semibold px-2 py-0.5 rounded",
                        event.type === "deposit" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"
                      )}>
                        {event.type.toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm text-rh-white font-medium">{formatCurrency(event.amount)}</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="text-right shrink-0 ml-4">
                  {event.kind === "trade" && (
                    <p className={clsx(
                      "text-sm font-medium",
                      event.side === "buy" ? "text-rh-red" : "text-rh-green"
                    )}>
                      {event.side === "buy" ? "-" : "+"}{formatCurrency(event.total)}
                    </p>
                  )}
                  <p className="text-xs text-rh-muted">{formatDate(event.date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
