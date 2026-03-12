export const DAY_MS = 24 * 60 * 60 * 1000;
export const YEAR_MS = 365 * DAY_MS;

/**
 * Format a timestamp for chart axis/tooltip labels.
 * Uses UTC to avoid timezone shifts on daily bars (Alpaca timestamps midnight UTC).
 * Uses local time only for intraday (1D) charts.
 */
export function formatTime(t: number, spanMs: number): string {
  if (spanMs <= DAY_MS) {
    // Intraday — show market-local time
    return new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (spanMs < YEAR_MS) {
    // Days/weeks/months — show date in UTC to match bar timestamps
    return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }
  // Multi-year — show month + full year in UTC
  return new Date(t).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * Compute N evenly-spaced tick timestamps across the data range.
 */
export function computeTicks(data: { t: number }[], count = 5): number[] {
  if (data.length === 0) return [];
  if (data.length === 1) return [data[0]!.t];
  const first = data[0]!.t;
  const last = data[data.length - 1]!.t;
  return Array.from({ length: count }, (_, i) =>
    Math.round(first + (i / (count - 1)) * (last - first))
  );
}
