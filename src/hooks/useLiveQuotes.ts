"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StockQuote } from "@/types";
import { getQuotes } from "@/lib/api";
import { isMarketOpen } from "@/lib/market-hours";

const STREAM_URL = "/api/stocks/quotes/stream";
const POLL_INTERVAL_MS = 15 * 60 * 1000;
/** Stale threshold: if no data arrives within this window, the stream is considered stale.
 *  30 s is enough to catch a failed stream during market hours. When the market is closed
 *  we suppress the fallback because no quotes come in anyway — see resetStaleTimer. */
const STREAM_STALE_MS = 30 * 1000;

/**
 * How often the UI flushes buffered price updates (ms).
 * All quotes update simultaneously on each flush — prevents per-symbol re-renders
 * and keeps the display readable at high update rates.
 * Override with NEXT_PUBLIC_PRICE_THROTTLE_MS env var.
 */
export const PRICE_THROTTLE_MS =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_PRICE_THROTTLE_MS
    ? parseInt(process.env.NEXT_PUBLIC_PRICE_THROTTLE_MS, 10)
    : 500;

export type QuoteStatus = "live" | "polling" | "error";

export const POLL_INTERVAL_MS_EXPORTED = POLL_INTERVAL_MS;

export function useLiveQuotes() {
  const [quotes, setQuotes] = useState<StockQuote[] | undefined>();
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<QuoteStatus>("polling");
  const [isPolling, setIsPolling] = useState(false);
  const [lastPollAt, setLastPollAt] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const staleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Buffer for streaming quotes — flushed to state every PRICE_THROTTLE_MS
  const pendingQuotesRef = useRef<StockQuote[] | null>(null);
  // Set to true when server explicitly emits source:"error" — prevents onerror from
  // overriding the error badge with a polling fallback (server has no data to poll either)
  const serverErrorRef = useRef(false);

  const applyQuotes = useCallback((data: StockQuote[]) => {
    setQuotes(data);
    setError(null);
    setIsLoading(false);
  }, []);

  // Flush buffered quotes on a fixed interval so all symbols update simultaneously
  useEffect(() => {
    const id = setInterval(() => {
      if (pendingQuotesRef.current !== null) {
        applyQuotes(pendingQuotesRef.current);
        pendingQuotesRef.current = null;
      }
    }, PRICE_THROTTLE_MS);
    return () => clearInterval(id);
  }, [applyQuotes]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setStatus("polling");
    setIsPolling(true);
    const poll = async () => {
      try {
        const data = await getQuotes();
        applyQuotes(data);
        setLastPollAt(Date.now());
      } catch (e) {
        setError(e instanceof Error ? e : new Error("Failed to fetch quotes"));
      }
    };
    void poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, [applyQuotes]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      setIsPolling(false);
      setLastPollAt(null);
    }
  }, []);

  const resetStaleTimer = useCallback(() => {
    if (staleRef.current) clearTimeout(staleRef.current);
    staleRef.current = setTimeout(() => {
      // When the market is closed, no quotes arrive — stream is stale but healthy.
      // Only fall back to polling if the market is currently open.
      if (isMarketOpen()) {
        stopPolling();
        startPolling();
      }
    }, STREAM_STALE_MS);
  }, [startPolling, stopPolling]);

  useEffect(() => {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}${STREAM_URL}` : STREAM_URL;
    let es: EventSource | null = new EventSource(url);

    es.onopen = () => {
      resetStaleTimer();
    };

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as {
          quotes?: StockQuote[];
          realtime?: boolean;
          source?: string;
        };
        const source = parsed?.source;

        if (source === "error") {
          // Data source failed on the server — show error badge, but still apply any quotes
          // in the payload so stock rows remain visible (prices are stale/placeholder).
          // Track this so onerror doesn't flip back to "polling" if the stream then closes.
          serverErrorRef.current = true;
          setStatus("error");
          const incoming = Array.isArray(parsed) ? parsed : (parsed.quotes ?? []);
          if (incoming.length > 0) {
            pendingQuotesRef.current = incoming;
            if (isLoading) {
              applyQuotes(incoming);
              pendingQuotesRef.current = null;
            }
          } else {
            setIsLoading(false);
          }
          resetStaleTimer();
          return;
        }

        const incoming = Array.isArray(parsed) ? parsed : (parsed.quotes ?? []);
        const realtime = source === "realtime" || parsed?.realtime === true;
        // Buffer the incoming quotes — the flush interval applies them atomically
        pendingQuotesRef.current = incoming;
        setStatus(realtime ? "live" : "polling");
        stopPolling();
        setLastPollAt(realtime ? null : Date.now());
        resetStaleTimer();
        // On first message, flush immediately to remove loading state
        if (isLoading) {
          applyQuotes(incoming);
          pendingQuotesRef.current = null;
        }
      } catch {
        setError(new Error("Invalid quote data"));
      }
    };

    es.onerror = () => {
      es?.close();
      es = null;
      setIsLoading(false);
      if (serverErrorRef.current) {
        // Server already told us it has no data source — keep error state, don't poll
        return;
      }
      // SSE connection failed for a transport reason — fall back to polling
      stopPolling();
      startPolling();
    };

    return () => {
      es?.close();
      stopPolling();
      if (staleRef.current) clearTimeout(staleRef.current);
      serverErrorRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyQuotes, startPolling, stopPolling, resetStaleTimer]);

  return {
    data: quotes,
    isLoading,
    error,
    status,
    isPolling,
    lastPollAt,
    isLive: status !== "error" && !error && quotes !== undefined,
  };
}
