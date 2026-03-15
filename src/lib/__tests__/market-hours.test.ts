import { describe, it, expect } from "vitest";
import { isMarketOpen } from "../market-hours";

/** Build a Date from a known ET time by working in UTC.
 *  ET is UTC-5 (EST) or UTC-4 (EDT). We use explicit UTC timestamps. */
function etDate(isoUTC: string): Date {
  return new Date(isoUTC);
}

describe("isMarketOpen", () => {
  // Reference dates (all UTC):
  //  Wed 2025-01-08 (winter, EST = UTC-5):  14:30 UTC = 09:30 ET, 21:00 UTC = 16:00 ET
  //  Wed 2025-07-09 (summer, EDT = UTC-4):  13:30 UTC = 09:30 ET, 20:00 UTC = 16:00 ET

  describe("weekdays (EST — January)", () => {
    it("returns true at market open 09:30 ET", () => {
      // 2025-01-08 Wed 09:30 ET = 14:30 UTC
      expect(isMarketOpen(etDate("2025-01-08T14:30:00Z"))).toBe(true);
    });

    it("returns false one minute before open (09:29 ET)", () => {
      // 14:29 UTC
      expect(isMarketOpen(etDate("2025-01-08T14:29:00Z"))).toBe(false);
    });

    it("returns true mid-session (12:00 ET)", () => {
      // 17:00 UTC
      expect(isMarketOpen(etDate("2025-01-08T17:00:00Z"))).toBe(true);
    });

    it("returns true one minute before close (15:59 ET)", () => {
      // 20:59 UTC
      expect(isMarketOpen(etDate("2025-01-08T20:59:00Z"))).toBe(true);
    });

    it("returns false at exactly close (16:00 ET)", () => {
      // 21:00 UTC
      expect(isMarketOpen(etDate("2025-01-08T21:00:00Z"))).toBe(false);
    });

    it("returns false after market close (17:00 ET)", () => {
      // 22:00 UTC
      expect(isMarketOpen(etDate("2025-01-08T22:00:00Z"))).toBe(false);
    });

    it("returns false before market open (08:00 ET)", () => {
      // 13:00 UTC
      expect(isMarketOpen(etDate("2025-01-08T13:00:00Z"))).toBe(false);
    });
  });

  describe("weekdays (EDT — July)", () => {
    it("returns true at market open 09:30 ET (summer)", () => {
      // 2025-07-09 Wed 09:30 ET = 13:30 UTC
      expect(isMarketOpen(etDate("2025-07-09T13:30:00Z"))).toBe(true);
    });

    it("returns false one minute before open (09:29 ET, summer)", () => {
      expect(isMarketOpen(etDate("2025-07-09T13:29:00Z"))).toBe(false);
    });

    it("returns false at close (16:00 ET, summer)", () => {
      // 20:00 UTC
      expect(isMarketOpen(etDate("2025-07-09T20:00:00Z"))).toBe(false);
    });

    it("returns true just before close (15:59 ET, summer)", () => {
      expect(isMarketOpen(etDate("2025-07-09T19:59:00Z"))).toBe(true);
    });
  });

  describe("weekends", () => {
    it("returns false on Saturday", () => {
      // 2025-01-11 Sat 12:00 ET = 17:00 UTC
      expect(isMarketOpen(etDate("2025-01-11T17:00:00Z"))).toBe(false);
    });

    it("returns false on Sunday", () => {
      // 2025-01-12 Sun 12:00 ET = 17:00 UTC
      expect(isMarketOpen(etDate("2025-01-12T17:00:00Z"))).toBe(false);
    });
  });

  describe("Monday and Friday boundaries", () => {
    it("returns true on Monday during market hours", () => {
      // 2025-01-13 Mon 10:00 ET = 15:00 UTC
      expect(isMarketOpen(etDate("2025-01-13T15:00:00Z"))).toBe(true);
    });

    it("returns true on Friday during market hours", () => {
      // 2025-01-10 Fri 15:00 ET = 20:00 UTC (EST, UTC-5)
      expect(isMarketOpen(etDate("2025-01-10T20:00:00Z"))).toBe(true);
    });

    it("returns true on Friday just before close", () => {
      // 2025-01-10 Fri 15:59 ET = 20:59 UTC
      expect(isMarketOpen(etDate("2025-01-10T20:59:00Z"))).toBe(true);
    });
  });
});
