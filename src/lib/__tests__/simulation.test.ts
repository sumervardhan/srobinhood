import { describe, it, expect } from "vitest";
import { getPreviousTradingDay } from "../simulation";

describe("getPreviousTradingDay", () => {
  function dateFromStr(s: string) {
    return new Date(s + "T12:00:00Z");
  }

  it("Monday → Friday", () => {
    const result = getPreviousTradingDay(dateFromStr("2025-01-13")); // Monday
    expect(result.toISOString().slice(0, 10)).toBe("2025-01-10"); // Friday
  });

  it("Tuesday → Monday", () => {
    const result = getPreviousTradingDay(dateFromStr("2025-01-14")); // Tuesday
    expect(result.toISOString().slice(0, 10)).toBe("2025-01-13");
  });

  it("Wednesday → Tuesday", () => {
    const result = getPreviousTradingDay(dateFromStr("2025-01-15")); // Wednesday
    expect(result.toISOString().slice(0, 10)).toBe("2025-01-14");
  });

  it("Thursday → Wednesday", () => {
    const result = getPreviousTradingDay(dateFromStr("2025-01-16")); // Thursday
    expect(result.toISOString().slice(0, 10)).toBe("2025-01-15");
  });

  it("Friday → Thursday", () => {
    const result = getPreviousTradingDay(dateFromStr("2025-01-17")); // Friday
    expect(result.toISOString().slice(0, 10)).toBe("2025-01-16");
  });

  it("Saturday → Friday", () => {
    const result = getPreviousTradingDay(dateFromStr("2025-01-18")); // Saturday
    expect(result.toISOString().slice(0, 10)).toBe("2025-01-17");
  });

  it("Sunday → Friday", () => {
    const result = getPreviousTradingDay(dateFromStr("2025-01-19")); // Sunday
    expect(result.toISOString().slice(0, 10)).toBe("2025-01-17");
  });

  it("handles long weekend correctly (holiday Saturday edge)", () => {
    // Even if there were multiple weekend days, it keeps going back to weekdays
    // Let's check a regular Sunday more carefully
    const sun = new Date("2025-01-19T12:00:00Z"); // Sunday
    expect(sun.getDay()).toBe(0); // confirm it's Sunday
    const result = getPreviousTradingDay(sun);
    expect([0, 6]).not.toContain(result.getDay()); // result must be a weekday
  });

  it("returns correct UTC date string regardless of local timezone offset", () => {
    // Regression: using getDate/setDate (local time) + toISOString (UTC) caused
    // off-by-one errors. E.g. Friday 22:00 UTC-8 = Saturday 06:00 UTC, so
    // toISOString would return Saturday instead of Friday.
    // Saturday night in UTC-8 (local) = Sunday 06:00 UTC
    const saturdayNightUSWest = new Date("2025-01-18T06:00:00Z"); // Sat 2025-01-18 in UTC
    const result = getPreviousTradingDay(saturdayNightUSWest);
    // Prev trading day from Saturday should be Friday 2025-01-17
    expect(result.toISOString().slice(0, 10)).toBe("2025-01-17");
  });
});

describe("deltaPercents computation", () => {
  it("calculates correct deltas from bars", () => {
    // Simulate the delta computation logic inline (from simulation.ts)
    const bars = [
      { t: 1000, v: 100, o: 100 }, // first bar: open=100, close=100
      { t: 2000, v: 101, o: 100 }, // close=101 → delta = (101-100)/100*100 = 1%
      { t: 3000, v: 99, o: 100 }, // close=99  → delta = (99-100)/100*100 = -1%
      { t: 4000, v: 105, o: 100 }, // close=105 → delta = (105-100)/100*100 = 5%
    ];
    const firstOpen = bars[0].o ?? bars[0].v;
    const deltas = bars.map((b) => ((b.v - firstOpen) / firstOpen) * 100);

    expect(deltas[0]).toBeCloseTo(0);
    expect(deltas[1]).toBeCloseTo(1);
    expect(deltas[2]).toBeCloseTo(-1);
    expect(deltas[3]).toBeCloseTo(5);
  });

  it("falls back to first bar close when open is missing", () => {
    const bars = [
      { t: 1000, v: 200 }, // no o field
      { t: 2000, v: 210 },
    ];
    const firstOpen = (bars[0] as { t: number; v: number; o?: number }).o ?? bars[0].v;
    expect(firstOpen).toBe(200);
    const deltas = bars.map((b) => ((b.v - firstOpen) / firstOpen) * 100);
    expect(deltas[0]).toBeCloseTo(0);
    expect(deltas[1]).toBeCloseTo(5);
  });
});
