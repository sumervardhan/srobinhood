/**
 * Top 10 US stocks by market cap (symbol, name).
 * Data pipeline can replace this list or keep in sync via config/API.
 */
export const SUPPORTED_STOCKS = [
  { symbol: "NVDA",  name: "NVIDIA Corporation",      ipoDate: "1999-01-22" },
  { symbol: "AAPL",  name: "Apple Inc.",               ipoDate: "1980-12-12" },
  { symbol: "GOOGL", name: "Alphabet Inc.",            ipoDate: "2004-08-19" },
  { symbol: "MSFT",  name: "Microsoft Corporation",   ipoDate: "1986-03-13" },
  { symbol: "AMZN",  name: "Amazon.com Inc.",          ipoDate: "1997-05-15" },
  { symbol: "TSM",   name: "Taiwan Semiconductor",    ipoDate: "1997-10-08" },
  { symbol: "META",  name: "Meta Platforms Inc.",      ipoDate: "2012-05-18" },
  { symbol: "AVGO",  name: "Broadcom Inc.",            ipoDate: "2009-08-06" },
  { symbol: "TSLA",  name: "Tesla Inc.",               ipoDate: "2010-06-29" },
  { symbol: "BRK.B", name: "Berkshire Hathaway",      ipoDate: "1996-05-09" },
] as const;

export const STOCK_SYMBOLS = SUPPORTED_STOCKS.map((s) => s.symbol);
export type SupportedSymbol = (typeof SUPPORTED_STOCKS)[number]["symbol"];
