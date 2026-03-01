"use client";

import { useSessionWithTimeout } from "@/hooks/useSessionWithTimeout";
import Link from "next/link";
import { useState, useCallback, useMemo, useEffect } from "react";
import { Nav } from "@/components/Nav";
import { Tabs, type TabId } from "@/components/Tabs";
import { StockRow } from "@/components/StockRow";
import { PositionRow } from "@/components/PositionRow";
import { OrderModal } from "@/components/OrderModal";
import { PortfolioChart } from "@/components/PortfolioChart";
import { StockExpandedView } from "@/components/StockExpandedView";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLiveQuotes } from "@/hooks/useLiveQuotes";
import { usePositions } from "@/hooks/usePositions";
import { useTrackedSymbols } from "@/hooks/useTrackedSymbols";
import { trackSymbol, untrackSymbol } from "@/lib/api";
import type { SupportedSymbol } from "@/lib/constants";

export default function HomePage() {
  const { data: session, status } = useSessionWithTimeout();
  const { data: quotes, isLoading: quotesLoading, error: quotesError, isLive, status: quoteStatus, isPolling } = useLiveQuotes();
  const { data: positions = [], isLoading: positionsLoading } = usePositions();
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
          <h1 className="text-2xl font-semibold text-rh-white mb-2">
            Trade top US stocks
          </h1>
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

  return (
    <>
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Tabs active={activeTab} onChange={setActiveTab} />
          {isLive && (
            <span className="ml-auto flex items-center gap-1.5 text-xs" aria-label={quoteStatus === "live" ? "Real-time streaming" : isPolling ? "5 minute refresh" : "1 minute refresh"}>
              {quoteStatus === "live" ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-rh-green animate-pulse" />
                  <span className="text-rh-green">Live</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                  <span className="text-yellow-500">{isPolling ? "5m Refresh" : "1m Refresh"}</span>
                </>
              )}
            </span>
          )}
        </div>

        {activeTab === "portfolio" && (
          <section>
            <PortfolioChart />
            {positionsLoading ? (
              <p className="text-rh-muted text-sm">Loading positions…</p>
            ) : positions.length > 0 ? (
              <div className="space-y-2">
                {livePositions.map((pos) => (
                  <div key={pos.symbol}>
                    <PositionRow
                      position={pos}
                      onTrade={openTrade}
                      onExpand={(s) => setExpandedSymbol(expandedSymbol === s ? null : s)}
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
          </section>
        )}

        {activeTab === "tracked" && (
          <section>
            {quotesLoading ? (
              <p className="text-rh-muted text-sm">Loading…</p>
            ) : trackedQuotes.length > 0 ? (
              <div className="space-y-2">
                {trackedQuotes.map((quote) => (
                  <div key={quote.symbol}>
                    <StockRow
                      quote={quote}
                      onTrade={openTrade}
                      onExpand={(s) => setExpandedSymbol(expandedSymbol === s ? null : s)}
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
          </section>
        )}

        {activeTab === "all" && (
          <section>
            {quotesError && (
              <p className="text-rh-red text-sm mb-2">Failed to load prices. Retrying…</p>
            )}
            {quotesLoading ? (
              <p className="text-rh-muted text-sm">Loading prices…</p>
            ) : quotes && quotes.length > 0 ? (
              <div className="space-y-2">
                {quotes.map((quote) => (
                  <div key={quote.symbol}>
                    <StockRow
                      quote={quote}
                      onTrade={openTrade}
                      onExpand={(s) => setExpandedSymbol(expandedSymbol === s ? null : s)}
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
          </section>
        )}
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
