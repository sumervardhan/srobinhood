"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSessionWithTimeout } from "@/hooks/useSessionWithTimeout";
import { Nav } from "@/components/Nav";
import { Tabs, type TabId } from "@/components/Tabs";
import { StockRow } from "@/components/StockRow";
import { PositionRow } from "@/components/PositionRow";
import { OrderModal } from "@/components/OrderModal";
import { PortfolioChart } from "@/components/PortfolioChart";
import { SpendingPowerCard } from "@/components/SpendingPowerCard";
import { TransactionLog } from "@/components/TransactionLog";
import { StockExpandedView } from "@/components/StockExpandedView";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLiveQuotes, POLL_INTERVAL_MS_EXPORTED } from "@/hooks/useLiveQuotes";
import { isMarketOpen } from "@/lib/market-hours";
import { usePositions } from "@/hooks/usePositions";
import { useSpendingPower } from "@/hooks/useSpendingPower";
import { BacktestPanel } from "@/components/BacktestPanel";
import { AdminPanel } from "@/components/AdminPanel";
import { useTrackedSymbols } from "@/hooks/useTrackedSymbols";
import { trackSymbol, untrackSymbol } from "@/lib/api";
import type { SupportedSymbol } from "@/lib/constants";

export default function HomePage() {
  const { data: session, status } = useSessionWithTimeout();
  const {
    data: quotes,
    isLoading: quotesLoading,
    error: quotesError,
    isLive,
    status: quoteStatus,
    isPolling,
    lastPollAt,
  } = useLiveQuotes();
  const { data: positions = [], isLoading: positionsLoading } = usePositions();
  const { data: spendingPowerData } = useSpendingPower();
  const { data: trackedSymbols = [] } = useTrackedSymbols();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("portfolio");
  const [tradeSymbol, setTradeSymbol] = useState<SupportedSymbol | null>(null);
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [expandedSymbol, setExpandedSymbol] = useState<SupportedSymbol | null>(null);

  useEffect(() => {
    setExpandedSymbol(null);
  }, [activeTab]);

  const trackMutation = useMutation({
    mutationFn: trackSymbol,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portfolio", "tracked"] }),
  });
  const untrackMutation = useMutation({
    mutationFn: untrackSymbol,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portfolio", "tracked"] }),
  });

  const openTrade = useCallback((symbol: SupportedSymbol, side?: "buy" | "sell") => {
    setTradeSymbol(symbol);
    setTradeSide(side ?? "buy");
  }, []);
  const closeTrade = useCallback(() => setTradeSymbol(null), []);

  const handleExpand = useCallback(
    (symbol: SupportedSymbol) => {
      const next = expandedSymbol === symbol ? null : symbol;
      const update = () => setExpandedSymbol(next);
      if (typeof document !== "undefined" && "startViewTransition" in document) {
        (
          document as Document & { startViewTransition: (cb: () => void) => void }
        ).startViewTransition(update);
      } else {
        update();
      }
    },
    [expandedSymbol]
  );

  const quoteFor = (symbol: SupportedSymbol) => quotes?.find((q) => q.symbol === symbol);
  const trackedQuotes = quotes?.filter((q) => trackedSymbols.includes(q.symbol)) ?? [];

  const livePositions = useMemo(() => {
    return positions.map((pos) => {
      const q = quotes?.find((x) => x.symbol === pos.symbol);
      if (!q) return pos;
      const marketValue = pos.quantity * q.price;
      const totalCost = pos.quantity * pos.averageCost;
      const gainLoss = marketValue - totalCost;
      const gainLossPercent = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;
      return {
        ...pos,
        currentPrice: q.price,
        marketValue,
        totalCost,
        gainLoss,
        gainLossPercent,
      };
    });
  }, [positions, quotes]);

  const [countdown, setCountdown] = useState<string>("15:00");
  useEffect(() => {
    if (quoteStatus !== "polling" || !lastPollAt) {
      setCountdown("15:00");
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, lastPollAt + POLL_INTERVAL_MS_EXPORTED - Date.now());
      const m = Math.floor(remaining / 60_000);
      const s = Math.floor((remaining % 60_000) / 1000);
      setCountdown(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [quoteStatus, lastPollAt]);

  if (status === "loading") {
    return (
      <>
        <Nav />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <p className="text-rh-muted">Loading…</p>
        </main>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <Nav />
        <main className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-semibold text-rh-white mb-2">Trade top US stocks</h1>
          <p className="text-rh-muted mb-6 max-w-md mx-auto">
            Sign in with Google to see live prices, your positions, and place market orders.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-rh-green text-rh-black font-semibold py-3 px-6 hover:bg-green-400 transition-colors"
          >
            Log in with Google
          </Link>
        </main>
      </>
    );
  }

  // When market is closed, "polling" and "live" are visually equivalent —
  // prices won't change regardless. Show green so the badge isn't misleadingly yellow.
  const effectiveQuoteStatus = quoteStatus === "polling" && !isMarketOpen() ? "live" : quoteStatus;

  const liveBadge =
    effectiveQuoteStatus === "error" ? (
      <span className="flex items-center gap-1.5 text-xs" aria-label="Error refreshing price data">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        <span className="text-red-500">Error Refreshing Price Data</span>
      </span>
    ) : isLive ? (
      <span
        className="flex items-center gap-1.5 text-xs"
        aria-label={
          effectiveQuoteStatus === "live" ? "Real-time streaming" : `Next update in ${countdown}`
        }
      >
        {effectiveQuoteStatus === "live" ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-rh-green animate-pulse" />
            <span className="text-rh-green">Live</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            <span className="text-yellow-500">
              Update in{" "}
              <span className="font-mono tabular-nums inline-block w-[3rem] text-left">
                {countdown}
              </span>
            </span>
          </>
        )}
      </span>
    ) : undefined;

  return (
    <>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 flex flex-col h-[calc(100vh-3.5rem-1.5rem)] overflow-hidden">
        <div className="shrink-0 pt-4 pb-3 flex items-center justify-between gap-4">
          <Tabs active={activeTab} onChange={setActiveTab} />
          {liveBadge}
        </div>
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 overflow-hidden">
          <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
            {activeTab === "portfolio" && (
              <section className="flex flex-col min-h-0 flex-1">
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-6">
                  <div className="px-2 space-y-4">
                    <PortfolioChart
                      liveValue={
                        livePositions.length > 0
                          ? livePositions.reduce((sum, p) => sum + p.marketValue, 0) +
                            (spendingPowerData?.spendingPower ?? 0)
                          : undefined
                      }
                    />
                    {positionsLoading ? (
                      <p className="text-rh-muted text-sm">Loading positions…</p>
                    ) : positions.length > 0 ? (
                      <div className="space-y-2 min-w-0">
                        {livePositions.map((pos) => (
                          <div key={pos.symbol} className="min-w-0">
                            <PositionRow
                              position={pos}
                              onTrade={openTrade}
                              onExpand={handleExpand}
                              isExpanded={expandedSymbol === pos.symbol}
                            />
                            {expandedSymbol === pos.symbol && (
                              <StockExpandedView
                                symbol={pos.symbol}
                                quote={quoteFor(pos.symbol)}
                                position={pos}
                                onBuy={() => openTrade(pos.symbol, "buy")}
                                onSell={() => openTrade(pos.symbol, "sell")}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-rh-muted text-sm">
                        No positions yet. Buy stocks from All Stocks to build your portfolio.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {activeTab === "tracked" && (
              <section className="flex flex-col min-h-0 flex-1">
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-6">
                  {quotesLoading ? (
                    <p className="text-rh-muted text-sm">Loading…</p>
                  ) : trackedQuotes.length > 0 ? (
                    <div className="space-y-2 min-w-0 px-2">
                      {trackedQuotes.map((quote) => (
                        <div key={quote.symbol} className="min-w-0">
                          <StockRow
                            quote={quote}
                            onTrade={openTrade}
                            onExpand={handleExpand}
                            isExpanded={expandedSymbol === quote.symbol}
                            onUntrack={(s) => untrackMutation.mutate(s)}
                            isTracked
                          />
                          {expandedSymbol === quote.symbol && (
                            <StockExpandedView
                              symbol={quote.symbol}
                              quote={quote}
                              position={positions.find((p) => p.symbol === quote.symbol)}
                              onBuy={() => openTrade(quote.symbol, "buy")}
                              onSell={() => openTrade(quote.symbol, "sell")}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-rh-muted text-sm">
                      No tracked stocks. Add symbols from All Stocks to watch them here.
                    </p>
                  )}
                </div>
              </section>
            )}

            {activeTab === "all" && (
              <section className="flex flex-col min-h-0 flex-1">
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-6">
                  {quotesError && (
                    <p className="text-rh-red text-sm mb-2">Failed to load prices. Retrying…</p>
                  )}
                  {quotesLoading ? (
                    <p className="text-rh-muted text-sm">Loading prices…</p>
                  ) : quotes && quotes.length > 0 ? (
                    <div className="space-y-2 min-w-0 px-2">
                      {quotes.map((quote) => (
                        <div key={quote.symbol} className="min-w-0">
                          <StockRow
                            quote={quote}
                            onTrade={openTrade}
                            onExpand={handleExpand}
                            isExpanded={expandedSymbol === quote.symbol}
                            onTrack={(s) => trackMutation.mutate(s)}
                            onUntrack={(s) => untrackMutation.mutate(s)}
                            isTracked={trackedSymbols.includes(quote.symbol)}
                          />
                          {expandedSymbol === quote.symbol && (
                            <StockExpandedView
                              symbol={quote.symbol}
                              quote={quote}
                              position={positions.find((p) => p.symbol === quote.symbol)}
                              onBuy={() => openTrade(quote.symbol, "buy")}
                              onSell={() => openTrade(quote.symbol, "sell")}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-rh-muted text-sm">No quotes available.</p>
                  )}
                </div>
              </section>
            )}
            {activeTab === "backtest" && (
              <section className="flex flex-col min-h-0 flex-1">
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-2">
                  <BacktestPanel />
                </div>
              </section>
            )}
            {activeTab === "admin" && (
              <section className="flex flex-col min-h-0 flex-1">
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-2">
                  <AdminPanel />
                </div>
              </section>
            )}
          </div>

          <aside className="w-full lg:w-80 flex-1 lg:flex-none min-h-0 flex flex-col gap-4">
            <SpendingPowerCard />
            <TransactionLog />
          </aside>
        </div>
      </main>

      {tradeSymbol && (
        <OrderModal
          key={tradeSymbol}
          symbol={tradeSymbol}
          quote={quoteFor(tradeSymbol)}
          initialSide={tradeSide}
          onClose={closeTrade}
        />
      )}
    </>
  );
}
