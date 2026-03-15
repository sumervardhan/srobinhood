/**
 * Simulation data manager.
 *
 * Fetches the previous trading day's 1-minute bars from Alpaca, computes
 * intraday delta-percents (% change from first bar's open), and persists
 * them in SimulationSnapshot (one row per symbol, always the latest trading day).
 *
 * When simulation mode is toggled on, these delta-percents are replayed at
 * 1.5 s/bar through live-prices.ts's setSimulationMode().
 *
 * Dependency rule: this file imports from live-prices.ts, NOT the reverse,
 * to avoid circular imports.
 */
import { setSimulationMode as lpSetSimulationMode } from "@/lib/live-prices";
import { fetchBars } from "@/lib/alpaca";
import { STOCK_SYMBOLS } from "@/lib/constants";
import { prisma } from "@/lib/db";

/** Returns the most recent weekday before `from` (skips Sat/Sun, no holiday logic). */
export function getPreviousTradingDay(from: Date): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

/** Format a Date as YYYY-MM-DD in UTC. */
function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Fetches 1-min bars for the previous trading day and upserts SimulationSnapshot rows.
 * Only overwrites if the stored tradingDate differs (weekend / same-day safety).
 * Throws if no bars could be fetched for any symbol (surfaces Alpaca errors to the caller).
 */
export async function fetchAndStoreSimulationData(): Promise<void> {
  const tradingDay = getPreviousTradingDay(new Date());
  const tradingDate = toDateString(tradingDay);

  // Market session: 9:30–16:00 ET. Use conservative UTC window (covers EST/EDT).
  const start = new Date(`${tradingDate}T13:30:00Z`);
  const end = new Date(`${tradingDate}T20:00:00Z`);

  let successCount = 0;
  let firstError: unknown = null;

  await Promise.allSettled(
    STOCK_SYMBOLS.map(async (symbol) => {
      try {
        // Check if we already have this day's data
        const existing = await prisma.simulationSnapshot.findUnique({ where: { symbol } });
        if (existing?.tradingDate === tradingDate) {
          successCount++;
          return; // already current
        }

        const bars = await fetchBars(symbol, "1Min", start, end, 500);
        if (bars.length === 0) {
          console.warn(`[simulation] No bars returned for ${symbol} on ${tradingDate}`);
          return;
        }

        const firstOpen = bars[0].o ?? bars[0].v;
        if (!firstOpen || firstOpen === 0) return;

        const deltaPercents = bars.map((b) => ((b.v - firstOpen) / firstOpen) * 100);

        await prisma.simulationSnapshot.upsert({
          where: { symbol },
          create: { symbol, tradingDate, deltaPercents },
          update: { tradingDate, deltaPercents },
        });
        successCount++;
      } catch (e) {
        if (!firstError) firstError = e;
        console.error(`[simulation] Failed to fetch/store bars for ${symbol}:`, e);
      }
    })
  );

  if (successCount === 0) {
    const msg =
      firstError instanceof Error
        ? firstError.message
        : String(firstError ?? "No bar data returned");
    throw new Error(`Simulation data unavailable: ${msg}`);
  }
}

/** Loads simulation data from DB, returns symbol → deltaPercents map. */
export async function getSimulationData(): Promise<Map<string, number[]>> {
  const rows = await prisma.simulationSnapshot.findMany();
  const map = new Map<string, number[]>();
  for (const row of rows) {
    if (Array.isArray(row.deltaPercents)) {
      map.set(row.symbol, row.deltaPercents as number[]);
    }
  }
  return map;
}

/** Persists across hot-reloads like live-prices.ts global state. */
const SIM_GLOBAL_KEY = "__srobinhood_simulation";
const simState = (
  typeof globalThis !== "undefined" && (globalThis as Record<string, unknown>)[SIM_GLOBAL_KEY]
    ? (globalThis as Record<string, unknown>)[SIM_GLOBAL_KEY]
    : ((globalThis as Record<string, unknown>)[SIM_GLOBAL_KEY] = {
        enabled: false as boolean,
        tradingDate: null as string | null,
        symbolCount: 0 as number,
      })
) as {
  enabled: boolean;
  tradingDate: string | null;
  symbolCount: number;
};

export function getSimulationState() {
  return {
    enabled: simState.enabled,
    tradingDate: simState.tradingDate,
    symbolCount: simState.symbolCount,
  };
}

/**
 * Toggle simulation mode on/off.
 * When enabling: fetches + stores bars if needed, then hands delta-percents
 * to live-prices.ts which drives the tick interval.
 */
export async function setSimulationMode(enabled: boolean): Promise<void> {
  if (enabled) {
    await fetchAndStoreSimulationData();
    const deltaPercents = await getSimulationData();

    // Infer trading date from loaded data
    const rows = await prisma.simulationSnapshot.findMany({
      select: { tradingDate: true },
      take: 1,
    });
    simState.tradingDate = rows[0]?.tradingDate ?? null;
    simState.symbolCount = deltaPercents.size;
    simState.enabled = true;

    lpSetSimulationMode(true, deltaPercents);
  } else {
    simState.enabled = false;
    lpSetSimulationMode(false, null);
  }
}
