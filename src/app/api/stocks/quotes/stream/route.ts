/**
 * SSE stream for live quotes. Clients connect and receive price updates in real time.
 * Each connection runs its own send loop to avoid shared-state issues with Next.js.
 */
import { getLiveQuotes } from "@/lib/live-prices";
import type { StockQuote } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SEND_INTERVAL_MS = 2000;

export async function GET() {
  if (process.env.NODE_ENV === "development") {
    console.log("[quotes/stream] Client connected");
  }
  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        try {
          const quotes = getLiveQuotes();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(quotes)}\n\n`));
        } catch {
          // stream closed
        }
      };

      send();
      intervalId = setInterval(send, SEND_INTERVAL_MS);
    },
    cancel() {
      if (intervalId) clearInterval(intervalId);
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
