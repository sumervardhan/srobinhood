"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StockQuote } from "@/types";
import { getQuotes } from "@/lib/api";

const STREAM_URL = "/api/stocks/quotes/stream";
const POLL_INTERVAL_MS = 2000;
const STREAM_STALE_MS = 5000; // Fall back to polling if no message for this long

export type QuoteStatus = "streaming" | "polling";

export function useLiveQuotes() {
  const [quotes, setQuotes] = useState<StockQuote[] | undefined>();
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<QuoteStatus>("streaming");
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
    setStatus("streaming");

    es.onopen = () => {
      resetStaleTimer();
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as StockQuote[];
        applyQuotes(data);
        setStatus("streaming");
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
    isLive: !error && quotes !== undefined,
  };
}
