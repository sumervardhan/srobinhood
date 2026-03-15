"use client";

import { clsx } from "clsx";

export type TabId = "portfolio" | "tracked" | "all" | "backtest" | "admin";

const TABS: { id: TabId; label: string }[] = [
  { id: "portfolio", label: "Portfolio" },
  { id: "tracked", label: "Tracked Stocks" },
  { id: "all", label: "All Stocks" },
  { id: "backtest", label: "Backtesting" },
  { id: "admin", label: "Admin" },
];

type Props = {
  active: TabId;
  onChange: (tab: TabId) => void;
};

export function Tabs({ active, onChange }: Props) {
  return (
    <nav className="flex border-b border-rh-border" role="tablist" aria-label="Main sections">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
            active === tab.id
              ? "border-rh-green text-rh-white"
              : "border-transparent text-rh-muted hover:text-rh-white"
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
