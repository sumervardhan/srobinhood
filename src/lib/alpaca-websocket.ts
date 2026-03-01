/**
 * Alpaca Market Data WebSocket client.
 * Connects to wss://stream.data.alpaca.markets/v2/iex for real-time quotes.
 */
import WebSocket from "ws";
import { STOCK_SYMBOLS } from "./constants";

const WS_URL = "wss://stream.data.alpaca.markets/v2/iex";

export type QuoteUpdate = { symbol: string; bid: number; ask: number };

function getCredentials(): { key: string; secret: string } {
  const key = process.env.ALPACA_API_KEY_ID;
  const secret = process.env.ALPACA_SECRET_KEY;
  if (!key || !secret) {
    throw new Error("Missing ALPACA_API_KEY_ID or ALPACA_SECRET_KEY");
  }
  return { key, secret };
}

function parseMessage(data: WebSocket.RawData): unknown[] {
  const raw = data.toString();
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

export function startAlpacaWebSocket(
  onQuote: (update: QuoteUpdate) => void,
  onError?: (err: Error) => void
): () => void {
  const { key, secret } = getCredentials();
  const ws = new WebSocket(WS_URL);
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const cleanup = () => {
    closed = true;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    try {
      ws.removeAllListeners();
      ws.close();
    } catch {
      /* ignore */
    }
  };

  ws.on("open", () => {
    if (process.env.NODE_ENV === "development") {
      console.log("[alpaca-ws] Connected, sending auth…");
    }
    ws.send(JSON.stringify({ action: "auth", key, secret }));
  });

  ws.on("message", (data) => {
    for (const msg of parseMessage(data)) {
      const obj = msg as Record<string, unknown>;
      const type = obj?.T as string | undefined;

      if (type === "success") {
        if (obj.msg === "connected" && process.env.NODE_ENV === "development") {
          console.log("[alpaca-ws] Server acknowledged connection");
        }
        if (obj.msg === "authenticated") {
          if (process.env.NODE_ENV === "development") {
            console.log("[alpaca-ws] Authenticated, subscribing to", STOCK_SYMBOLS.length, "symbols");
          }
          ws.send(JSON.stringify({ action: "subscribe", quotes: [...STOCK_SYMBOLS] }));
        }
      }

      if (type === "error") {
        const code = obj?.code ?? "?";
        const msg = (obj?.msg ?? obj?.message ?? "unknown") as string;
        console.error("[alpaca-ws] Server error:", code, msg);
        closed = true; // prevent reconnect on 406 etc.
        onError?.(new Error(`Alpaca stream: ${code} ${msg}`));
      }

      if (type === "subscription" && process.env.NODE_ENV === "development") {
        console.log("[alpaca-ws] Subscription confirmed:", obj);
      }

      if (type === "q") {
        const symbol = obj.S as string;
        const bp = Number(obj.bp ?? 0);
        const ap = Number(obj.ap ?? 0);
        if (symbol && (bp > 0 || ap > 0)) {
          const bid = bp > 0 ? bp : ap;
          const ask = ap > 0 ? ap : bp;
          onQuote({ symbol, bid, ask });
        }
      }
    }
  });

  ws.on("error", (err) => {
    console.error("[alpaca-ws] WebSocket error:", err.message);
    onError?.(err);
  });

  ws.on("close", (code, reason) => {
    if (process.env.NODE_ENV === "development" && !closed) {
      console.log("[alpaca-ws] Connection closed:", code, reason?.toString() || "");
    }
    if (closed) return;
    reconnectTimeout = setTimeout(() => {
      if (!closed) {
        if (process.env.NODE_ENV === "development") {
          console.log("[alpaca-ws] Reconnecting…");
        }
        startAlpacaWebSocket(onQuote, onError);
      }
    }, 5000);
  });

  return cleanup;
}
