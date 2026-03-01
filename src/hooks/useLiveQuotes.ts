"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StockQuote } from "@/types";
import { getQuotes } from "@/lib/api";

const STREAM_URL = "/api/stocks/quotes/stream";
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STREAM_STALE_MS = 90 * 1000; // 90s - must exceed heartbeat (1m); fall back to polling if no message

export type QuoteStatus = "live" | "polling";

export function useLiveQuotes() {
  const [quotes, setQuotes] = useState<StockQuote[] | undefined>();
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<QuoteStatus>("polling");
  const [isPolling, setIsPolling] = useState(false); // true = REST fallback (5m), false = stream (2s or live)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const staleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyQuotes = useCallback((data: StockQuote[]) => {
    setQuotes(data);
    setError(null);
    setIsLoading(false);
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setStatus("polling");
    setIsPolling(true);
    const poll = async () => {
      try {
        const data = await getQuotes();
        applyQuotes(data);
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
    }
  }, []);

  const resetStaleTimer = useCallback(() => {
    if (staleRef.current) clearTimeout(staleRef.current);
    staleRef.current = setTimeout(() => {
      stopPolling();
      startPolling();
    }, STREAM_STALE_MS);
  }, [startPolling, stopPolling]);

  useEffect(() => {
    const url = typeof window !== "undefined" ? `${window.location.origin}${STREAM_URL}` : STREAM_URL;
    let es: EventSource | null = new EventSource(url);

    es.onopen = () => {
      resetStaleTimer();
    };

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as { quotes?: StockQuote[]; realtime?: boolean };
        const quotes = Array.isArray(parsed) ? parsed : parsed.quotes ?? [];
        const realtime = parsed?.realtime === true;
        applyQuotes(quotes);
        setStatus(realtime ? "live" : "polling");
        stopPolling();
        resetStaleTimer();
      } catch {
        setError(new Error("Invalid quote data"));
      }
    };

    es.onerror = () => {
      es?.close();
      es = null;
      stopPolling();
      startPolling();
      setIsLoading(false);
    };

    return () => {
      es?.close();
      stopPolling();
      if (staleRef.current) clearTimeout(staleRef.current);
    };
  }, [applyQuotes, startPolling, stopPolling, resetStaleTimer]);

  return {
    data: quotes,
    isLoading,
    error,
    status,
    isPolling,
    isLive: !error && quotes !== undefined,
  };
}
