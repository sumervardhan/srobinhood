import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Module mocks (must be hoisted before imports) ---
vi.mock("../alpaca", () => ({
  isAlpacaConfigured: vi.fn(() => false),
  fetchSnapshots: vi.fn().mockRejectedValue(new Error("Alpaca unavailable")),
}));
vi.mock("../alpaca-websocket", () => ({
  startAlpacaWebSocket: vi.fn(() => () => {}),
}));
vi.mock("../constants", () => ({
  SUPPORTED_STOCKS: [
    { symbol: "AAPL", name: "Apple", ipoDate: "1980-12-12" },
    { symbol: "MSFT", name: "Microsoft", ipoDate: "1986-03-13" },
  ],
  STOCK_SYMBOLS: ["AAPL", "MSFT"],
}));

import { isAlpacaConfigured, fetchSnapshots } from "../alpaca";
import { startAlpacaWebSocket } from "../alpaca-websocket";

describe("live-prices error state", () => {
  beforeEach(() => {
    // Clear the global state key so each test gets a fresh module state
    if (typeof globalThis !== "undefined") {
      (globalThis as Record<string, unknown>)["__srobinhood_live_prices_v2"] = undefined;
    }
    vi.resetModules();
  });

  it("emits source:'error' immediately when Alpaca is not configured", async () => {
    vi.mocked(isAlpacaConfigured).mockReturnValue(false);

    // Re-import after resetting modules so globalThis state is fresh
    const { subscribe } = await import("../live-prices");

    const payloads: { source: string }[] = [];
    const unsub = subscribe((p) => payloads.push({ source: p.source }));

    expect(payloads.length).toBeGreaterThan(0);
    expect(payloads[0].source).toBe("error");

    unsub();
  });

  it("emits realtime:false when source is 'rest'", async () => {
    vi.mocked(isAlpacaConfigured).mockReturnValue(false);
    const { subscribe } = await import("../live-prices");

    const payloads: { source: string; realtime: boolean }[] = [];
    const unsub = subscribe((p) => payloads.push({ source: p.source, realtime: p.realtime }));

    expect(payloads[0].realtime).toBe(false);
    unsub();
  });

  it("error payload sets realtime to false (backward compat)", async () => {
    vi.mocked(isAlpacaConfigured).mockReturnValue(false);
    const { subscribe } = await import("../live-prices");

    const payloads: { source: string; realtime: boolean }[] = [];
    const unsub = subscribe((p) => payloads.push({ source: p.source, realtime: p.realtime }));

    const errorPayload = payloads.find((p) => p.source === "error");
    expect(errorPayload).toBeDefined();
    expect(errorPayload?.realtime).toBe(false);

    unsub();
  });
});

describe("live-prices Vercel REST-only mode", () => {
  beforeEach(() => {
    if (typeof globalThis !== "undefined") {
      (globalThis as Record<string, unknown>)["__srobinhood_live_prices_v2"] = undefined;
    }
    vi.resetModules();
    process.env.VERCEL = "1";
  });

  afterEach(() => {
    delete process.env.VERCEL;
  });

  it("does not attempt WebSocket when VERCEL env var is set", async () => {
    vi.mocked(isAlpacaConfigured).mockReturnValue(true);
    vi.mocked(fetchSnapshots).mockResolvedValue([
      { symbol: "AAPL", price: 150, prevClose: 148, updatedAt: new Date().toISOString() },
      { symbol: "MSFT", price: 300, prevClose: 295, updatedAt: new Date().toISOString() },
    ]);

    const { subscribe } = await import("../live-prices");
    const unsub = subscribe(() => {});

    expect(vi.mocked(startAlpacaWebSocket)).not.toHaveBeenCalled();
    unsub();
  });

  it("emits source:'rest' (not error) when Alpaca is configured on Vercel", async () => {
    vi.mocked(isAlpacaConfigured).mockReturnValue(true);
    vi.mocked(fetchSnapshots).mockResolvedValue([
      { symbol: "AAPL", price: 150, prevClose: 148, updatedAt: new Date().toISOString() },
      { symbol: "MSFT", price: 300, prevClose: 295, updatedAt: new Date().toISOString() },
    ]);

    const { subscribe } = await import("../live-prices");
    const payloads: { source: string }[] = [];
    const unsub = subscribe((p) => payloads.push({ source: p.source }));

    expect(payloads[0].source).not.toBe("error");
    unsub();
  });
});
