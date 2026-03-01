"use client";

import { useSessionWithTimeout } from "@/hooks/useSessionWithTimeout";
import Link from "next/link";
import { useState, useCallback } from "react";
import { Nav } from "@/components/Nav";
import { StockRow } from "@/components/StockRow";
import { PositionRow } from "@/components/PositionRow";
import { OrderModal } from "@/components/OrderModal";
import { useQuotes } from "@/hooks/useQuotes";
import { usePositions } from "@/hooks/usePositions";
import type { SupportedSymbol } from "@/lib/constants";

export default function HomePage() {
  const { data: session, status } = useSessionWithTimeout();
  const { data: quotes, isLoading: quotesLoading, error: quotesError } = useQuotes();
  const { data: positions = [], isLoading: positionsLoading } = usePositions();
  const [tradeSymbol, setTradeSymbol] = useState<SupportedSymbol | null>(null);

  const openTrade = useCallback((symbol: SupportedSymbol) => {
    setTradeSymbol(symbol);
  }, []);
  const closeTrade = useCallback(() => setTradeSymbol(null), []);

  const quoteFor = (symbol: SupportedSymbol) => quotes?.find((q) => q.symbol === symbol);

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
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {positions.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-rh-white mb-3">Your positions</h2>
            {positionsLoading ? (
              <p className="text-rh-muted text-sm">Loading positions…</p>
            ) : (
              <div className="space-y-2">
                {positions.map((pos) => (
                  <PositionRow
                    key={pos.symbol}
                    position={pos}
                    onTrade={openTrade}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold text-rh-white mb-3">Stocks</h2>
          {quotesError && (
            <p className="text-rh-red text-sm mb-2">
              Failed to load prices. Retrying…
            </p>
          )}
          {quotesLoading ? (
            <p className="text-rh-muted text-sm">Loading prices…</p>
          ) : quotes && quotes.length > 0 ? (
            <div className="space-y-2">
              {quotes.map((quote) => (
                <StockRow
                  key={quote.symbol}
                  quote={quote}
                  onTrade={openTrade}
                />
              ))}
            </div>
          ) : (
            <p className="text-rh-muted text-sm">No quotes available.</p>
          )}
        </section>
      </main>

      {tradeSymbol && (
        <OrderModal
          symbol={tradeSymbol}
          quote={quoteFor(tradeSymbol)}
          onClose={closeTrade}
        />
      )}
    </>
  );
}
