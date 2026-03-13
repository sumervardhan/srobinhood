/**
 * SSE stream for live quotes. Subscribes to live-prices for real-time push
 * (Alpaca WebSocket) or periodic updates (REST/simulated/heartbeat).
 */
import { subscribe, getLiveQuotes } from "@/lib/live-prices";
import type { StockQuote } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (process.env.NODE_ENV === "development") {
    console.log("[quotes/stream] Client connected");
  }
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: { quotes: StockQuote[]; realtime: boolean }) => {
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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
