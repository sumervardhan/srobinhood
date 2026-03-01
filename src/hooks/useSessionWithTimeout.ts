"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

const LOADING_TIMEOUT_MS = 3000;

/**
 * Wraps useSession and stops showing "loading" after a timeout.
 * Avoids being stuck on the loading screen when the session endpoint
 * never resolves (e.g. missing NEXTAUTH_URL or NEXTAUTH_SECRET).
 */
export function useSessionWithTimeout() {
  const { data: session, status, ...rest } = useSession();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (status !== "loading") return;
    const t = setTimeout(() => setTimedOut(true), LOADING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [status]);

  // Once session resolves, clear timeout state for next time
  useEffect(() => {
    if (status !== "loading") setTimedOut(false);
  }, [status]);

  const effectiveStatus =
    status === "loading" && timedOut ? "unauthenticated" : status;

  return {
    data: session,
    status: effectiveStatus,
    isLoading: effectiveStatus === "loading",
    ...rest,
  };
}
