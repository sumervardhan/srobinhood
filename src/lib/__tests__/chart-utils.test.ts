import { describe, it, expect } from "vitest";
import { formatTime, computeTicks, DAY_MS, YEAR_MS } from "../chart-utils";

describe("computeTicks", () => {
  it("returns empty array for empty data", () => {
    expect(computeTicks([])).toEqual([]);
  });

  it("returns single tick for single data point", () => {
    expect(computeTicks([{ t: 1000 }])).toEqual([1000]);
  });

  it("returns evenly spaced ticks across range", () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ t: i * 1000 }));
    const ticks = computeTicks(data, 5);
    expect(ticks).toHaveLength(5);
    expect(ticks[0]).toBe(0);
    expect(ticks[4]).toBe(99000);
  });

  it("defaults to 5 ticks", () => {
    const data = [{ t: 0 }, { t: 100 }, { t: 200 }];
    expect(computeTicks(data)).toHaveLength(5);
  });
});

describe("formatTime", () => {
  const intraday = DAY_MS / 2; // 12 hours — within 1D span
  const monthly = DAY_MS * 30; // 30 days
  const multiYear = YEAR_MS * 2; // 2 years

  it("formats intraday timestamps as time (hh:mm)", () => {
    const result = formatTime(Date.UTC(2024, 0, 15, 14, 30), intraday);
    // Should include time components (hours and minutes)
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("formats daily chart timestamps as month + day", () => {
    const result = formatTime(Date.UTC(2024, 5, 15), monthly);
    expect(result).toMatch(/Jun/i);
    expect(result).toMatch(/15/);
  });

  it("formats multi-year timestamps as month + year", () => {
    const result = formatTime(Date.UTC(2024, 5, 15), multiYear);
    expect(result).toMatch(/Jun/i);
    expect(result).toMatch(/2024/);
  });
});
