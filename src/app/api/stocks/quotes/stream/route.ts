/**
 * SSE stream for live quotes.
 *
 * Two modes depending on whether Redis is configured:
 *
 *  Redis (production, Vercel):
 *    - Sends the latest cached snapshot immediately so the browser has prices
 *      on first paint even before the next WebSocket tick.
 *    - Subscribes to the PRICES_CHANNEL pub/sub channel; every message the
 *      worker publishes is forwarded to the browser as an SSE frame.
 *    - Each SSE connection uses a dedicated ioredis subscriber connection
 *      (SUBSCRIBE blocks the connection so it can't share the command client).
 *
 *  No Redis (local dev):
 *    - Falls back to the in-process live-prices.ts singleton, which manages
 *      the Alpaca WebSocket directly and notifies local subscribers.
 */
import { subscribe } from "@/lib/live-prices";
import type { NotifyPayload } from "@/lib/live-prices";
import {
  redis,
  isRedisConfigured,
  createSubscriber,
  PRICES_CHANNEL,
  PRICES_SNAPSHOT_KEY,
} from "@/lib/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

export async function GET() {
  if (process.env.NODE_ENV === "development") {
    console.log("[quotes/stream] Client connected");
  }

  const encoder = new TextEncoder();

  // -- Redis path (production) -----------------------------------------------
  if (isRedisConfigured()) {
    const sub = createSubscriber();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: string) => {
          try {
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          } catch {
            // stream closed -- subscriber cleanup happens in cancel()
          }
        };

        // Send the latest cached snapshot immediately so the browser doesn't
        // wait for the next WebSocket tick before showing prices.
        if (redis) {
          const snapshot = await redis.get(PRICES_SNAPSHOT_KEY).catch(() => null);
          if (snapshot) send(snapshot);
        }

        sub.on("message", (_channel, message) => send(message));
        sub.on("error", (err) => {
          console.error("[quotes/stream] Redis subscriber error:", err.message);
        });

        await sub.subscribe(PRICES_CHANNEL);
      },
      cancel() {
        sub.unsubscribe().catch(() => {});
        sub.quit().catch(() => {});
      },
    });

    return new Response(stream, { headers: SSE_HEADERS });
  }

  // -- Local dev fallback (no Redis) ----------------------------------------
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: NotifyPayload) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // stream closed
        }
      };
      unsubscribe = subscribe(send);
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
