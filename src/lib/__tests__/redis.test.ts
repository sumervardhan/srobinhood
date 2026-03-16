import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("isRedisConfigured", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    // Restore env and clear module cache
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("returns false when REDIS_URL is not set", async () => {
    delete process.env.REDIS_URL;
    const { isRedisConfigured } = await import("../redis");
    expect(isRedisConfigured()).toBe(false);
  });

  it("returns true when REDIS_URL is set", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    // We don't want to actually connect — mock ioredis
    vi.doMock("ioredis", () => {
      const MockRedis = vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        quit: vi.fn().mockResolvedValue(undefined),
      }));
      return { default: MockRedis };
    });
    const { isRedisConfigured } = await import("../redis");
    expect(isRedisConfigured()).toBe(true);
  });

  it("redis export is null when REDIS_URL is not set", async () => {
    delete process.env.REDIS_URL;
    const { redis } = await import("../redis");
    expect(redis).toBeNull();
  });
});

describe("Redis constants", () => {
  it("exports expected channel and key names", async () => {
    const {
      PRICES_CHANNEL,
      PRICES_SNAPSHOT_KEY,
      PRICES_SNAPSHOT_TTL_S,
      WORKER_LOCK_KEY,
      WORKER_LOCK_TTL_S,
    } = await import("../redis");

    expect(PRICES_CHANNEL).toBe("srobinhood:prices");
    expect(PRICES_SNAPSHOT_KEY).toBe("srobinhood:prices:snapshot");
    expect(PRICES_SNAPSHOT_TTL_S).toBe(7200);
    expect(WORKER_LOCK_KEY).toBe("srobinhood:worker:lock");
    expect(WORKER_LOCK_TTL_S).toBe(120);
  });
});
