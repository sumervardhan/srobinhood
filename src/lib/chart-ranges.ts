/**
 * Robinhood-style chart time ranges.
 */
export const CHART_RANGES = ["1D", "5D", "1M", "3M", "1Y", "5Y", "All"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];
