import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mocks before any imports
vi.mock("@/lib/redis", () => ({
  isRedisConfigured: vi.fn(() => false),
  redis: null,
  PRICES_CHANNEL: "srobinhood:prices",
  PRICES_SNAPSHOT_KEY: "srobinhood:prices:snapshot",
  PRICES_SNAPSHOT_TTL_S: 7200,
  WORKER_LOCK_KEY: "srobinhood:worker:lock",
  WORKER_LOCK_TTL_S: 120,
}));

vi.mock("@/lib/alpaca", () => ({
  isAlpacaConfigured: vi.fn(() => false),
  fetchSnapshots: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/alpaca-websocket", () => ({
  startAlpacaWebSocket: vi.fn(() => () => {}),
}));

vi.mock("@/lib/constants", () => ({
  SUPPORTED_STOCKS: [
    { symbol: "AAPL", name: "Apple", ipoDate: "1980-12-12" },
    { symbol: "MSFT", name: "Microsoft", ipoDate: "1986-03-13" },
  ],
  STOCK_SYMBOLS: ["AAPL", "MSFT"],
}));

vi.mock("@vercel/functions", () => ({
  waitUntil: vi.fn(),
}));

import { isRedisConfigured } from "@/lib/redis";
import { isAlpacaConfigured } from "@/lib/alpaca";

describe("GET /api/worker/prices", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 400 when Redis is not configured", async () => {
    vi.mocked(isRedisConfigured).mockReturnValue(false);
    vi.mocked(isAlpacaConfigured).mockReturnValue(true);

    const { GET } = await import("../prices/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/REDIS_URL/i);
  });

  it("returns 400 when Alpaca is not configured", async () => {
    vi.mocked(isRedisConfigured).mockReturnValue(true);
    vi.mocked(isAlpacaConfigured).mockReturnValue(false);

    const { GET } = await import("../prices/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/Alpaca/i);
  });

  it("returns already_running when lock is not acquired", async () => {
    vi.mocked(isRedisConfigured).mockReturnValue(true);
    vi.mocked(isAlpacaConfigured).mockReturnValue(true);

    // Provide a mock redis that returns null for SET NX (lock already held)
    const mockRedis = {
      set: vi.fn().mockResolvedValue(null),
      del: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue(null),
      multi: vi.fn().mockReturnThis(),
      publish: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    };

    vi.doMock("@/lib/redis", () => ({
      isRedisConfigured: vi.fn(() => true),
      redis: mockRedis,
      PRICES_CHANNEL: "srobinhood:prices",
      PRICES_SNAPSHOT_KEY: "srobinhood:prices:snapshot",
      PRICES_SNAPSHOT_TTL_S: 7200,
      WORKER_LOCK_KEY: "srobinhood:worker:lock",
      WORKER_LOCK_TTL_S: 120,
    }));

    vi.resetModules();
    vi.doMock("@/lib/redis", () => ({
      isRedisConfigured: vi.fn(() => true),
      redis: mockRedis,
      PRICES_CHANNEL: "srobinhood:prices",
      PRICES_SNAPSHOT_KEY: "srobinhood:prices:snapshot",
      PRICES_SNAPSHOT_TTL_S: 7200,
      WORKER_LOCK_KEY: "srobinhood:worker:lock",
      WORKER_LOCK_TTL_S: 120,
    }));
    vi.doMock("@/lib/alpaca", () => ({
      isAlpacaConfigured: vi.fn(() => true),
      fetchSnapshots: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@vercel/functions", () => ({ waitUntil: vi.fn() }));
    vi.doMock("@/lib/alpaca-websocket", () => ({
      startAlpacaWebSocket: vi.fn(() => () => {}),
    }));
    vi.doMock("@/lib/constants", () => ({
      SUPPORTED_STOCKS: [{ symbol: "AAPL", name: "Apple", ipoDate: "1980-12-12" }],
      STOCK_SYMBOLS: ["AAPL"],
    }));

    const { GET } = await import("../prices/route");
    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe("already_running");
  });

  it("returns started and calls waitUntil when lock is acquired", async () => {
    vi.resetModules();

    const mockWaitUntil = vi.fn();
    const mockRedis = {
      set: vi.fn().mockResolvedValue("OK"),
      del: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue(null),
      multi: vi.fn().mockReturnThis(),
      publish: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    };

    vi.doMock("@/lib/redis", () => ({
      isRedisConfigured: vi.fn(() => true),
      redis: mockRedis,
      PRICES_CHANNEL: "srobinhood:prices",
      PRICES_SNAPSHOT_KEY: "srobinhood:prices:snapshot",
      PRICES_SNAPSHOT_TTL_S: 7200,
      WORKER_LOCK_KEY: "srobinhood:worker:lock",
      WORKER_LOCK_TTL_S: 120,
    }));
    vi.doMock("@/lib/alpaca", () => ({
      isAlpacaConfigured: vi.fn(() => true),
      fetchSnapshots: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock("@vercel/functions", () => ({ waitUntil: mockWaitUntil }));
    vi.doMock("@/lib/alpaca-websocket", () => ({
      startAlpacaWebSocket: vi.fn(() => () => {}),
    }));
    vi.doMock("@/lib/constants", () => ({
      SUPPORTED_STOCKS: [{ symbol: "AAPL", name: "Apple", ipoDate: "1980-12-12" }],
      STOCK_SYMBOLS: ["AAPL"],
    }));

    const { GET } = await import("../prices/route");
    const res = await GET();
    const body = await res.json();

    expect(body.status).toBe("started");
    expect(mockWaitUntil).toHaveBeenCalledTimes(1);
  });
});
