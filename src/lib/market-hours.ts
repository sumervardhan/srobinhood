/**
 * NYSE trading hours utility.
 *
 * Standard hours: 9:30 AM – 4:00 PM America/New_York, Monday–Friday.
 * DST transitions are handled automatically by Intl.DateTimeFormat.
 *
 * NOTE: US market holidays are not accounted for. On holidays this function
 * will return true even though the market is closed — an accepted limitation.
 */
export function isMarketOpen(now: Date = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const day = parts.weekday; // "Mon", "Tue", ..., "Sat", "Sun"
  const hour = parseInt(parts.hour, 10);
  const minute = parseInt(parts.minute, 10);

  if (day === "Sat" || day === "Sun") return false;

  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= 9 * 60 + 30 && totalMinutes < 16 * 60;
}
