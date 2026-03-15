/**
 * Redis client for cross-instance pub/sub and price caching.
 *
 * Two connection roles:
 *  - `redis`      — shared singleton for GET/SET/PUBLISH/EXPIRE commands
 *  - `createSubscriber()` — fresh connection per SSE stream (SUBSCRIBE blocks
 *    the connection so it cannot be shared with the command client)
 *
 * Both are null when REDIS_URL is not set (local dev without Redis).
 * All production code should call `isRedisConfigured()` before using them.
 */
import Redis, { type RedisOptions } from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

export function isRedisConfigured(): boolean {
  return !!REDIS_URL;
}

function makeClient(opts?: RedisOptions): Redis {
  return new Redis(REDIS_URL!, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: false,
    ...opts,
  });
}

/** Singleton command client — shared across hot-reloads via globalThis. */
const GLOBAL_KEY = "__srobinhood_redis_client";
export const redis: Redis | null = REDIS_URL
  ? (((globalThis as Record<string, unknown>)[GLOBAL_KEY] as Redis | undefined) ??
    (() => {
      const client = makeClient();
      (globalThis as Record<string, unknown>)[GLOBAL_KEY] = client;
      return client;
    })())
  : null;

/**
 * Create a dedicated subscriber connection.
 * Caller is responsible for calling `.quit()` when done.
 */
export function createSubscriber(): Redis {
  if (!REDIS_URL) throw new Error("Redis not configured");
  return makeClient({ maxRetriesPerRequest: 0 });
}

// ── Channel / key constants ───────────────────────────────────────────────────

/** Pub/sub channel: worker publishes NotifyPayload JSON here. */
export const PRICES_CHANNEL = "srobinhood:prices";

/**
 * Latest snapshot key: stores the most recent NotifyPayload JSON string.
 * New SSE connections read this for an immediate first frame.
 * TTL = 2 hours (covers overnight when market is closed).
 */
export const PRICES_SNAPSHOT_KEY = "srobinhood:prices:snapshot";
export const PRICES_SNAPSHOT_TTL_S = 7200;

/** Worker lock key: SET NX EX prevents multiple instances running the WS. */
export const WORKER_LOCK_KEY = "srobinhood:worker:lock";
export const WORKER_LOCK_TTL_S = 120;
