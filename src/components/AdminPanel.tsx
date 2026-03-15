"use client";

import { useState, useEffect } from "react";

type SimState = {
  enabled: boolean;
  tradingDate: string | null;
  symbolCount: number;
};

export function AdminPanel() {
  const [simState, setSimState] = useState<SimState | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/simulate")
      .then((r) => r.json() as Promise<SimState>)
      .then(setSimState)
      .catch(() => setFetchError("Failed to load simulation status"))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    if (!simState || toggling) return;
    setToggling(true);
    setFetchError(null);
    try {
      const next = !simState.enabled;
      const res = await fetch("/api/admin/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error("Request failed");
      const updated = (await res.json()) as SimState;
      setSimState(updated);
    } catch {
      setFetchError("Failed to toggle simulation mode");
    } finally {
      setToggling(false);
    }
  };

  const statusText = () => {
    if (!simState) return null;
    if (toggling) return simState.enabled ? "Disabling…" : "Loading data…";
    if (!simState.enabled) return "Disabled";
    if (simState.tradingDate)
      return `Replaying ${simState.tradingDate} (${simState.symbolCount} symbols)`;
    return "Active";
  };

  return (
    <div className="px-2 py-4 space-y-6">
      <h2 className="text-sm font-semibold text-rh-white">Admin</h2>

      <div className="rounded-xl bg-rh-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-rh-white">Simulate Live Data</p>
            <p className="text-xs text-rh-muted">
              Replay previous trading day price movements at the live price refresh rate.
            </p>
          </div>

          <button
            role="switch"
            aria-checked={simState?.enabled ?? false}
            aria-label="Simulate Live Data"
            disabled={loading || toggling}
            onClick={handleToggle}
            className={[
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
              "transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-rh-green",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              simState?.enabled ? "bg-rh-green" : "bg-rh-border",
            ].join(" ")}
          >
            <span
              className={[
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow",
                "transition-transform duration-200",
                simState?.enabled ? "translate-x-5" : "translate-x-0",
              ].join(" ")}
            />
          </button>
        </div>

        {(loading || statusText()) && (
          <p className="text-xs text-rh-muted">{loading ? "Loading…" : statusText()}</p>
        )}

        {fetchError && <p className="text-xs text-red-500">{fetchError}</p>}
      </div>
    </div>
  );
}
