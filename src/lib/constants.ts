/**
 * Top 10 US stocks by market cap (symbol, name).
 * Data pipeline can replace this list or keep in sync via config/API.
 */
export const SUPPORTED_STOCKS = [
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "GOOGL", name: "Alphabet Inc." },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "TSM", name: "Taiwan Semiconductor" },
  { symbol: "META", name: "Meta Platforms Inc." },
  { symbol: "AVGO", name: "Broadcom Inc." },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "BRK.B", name: "Berkshire Hathaway" },
] as const;

export const STOCK_SYMBOLS = SUPPORTED_STOCKS.map((s) => s.symbol);
export type SupportedSymbol = (typeof SUPPORTED_STOCKS)[number]["symbol"];
