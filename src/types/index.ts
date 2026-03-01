import type { SupportedSymbol } from "@/lib/constants";

export interface StockQuote {
  symbol: SupportedSymbol;
  price: number;
  change: number;
  changePercent: number;
  updatedAt: string; // ISO
}

export interface Position {
  symbol: SupportedSymbol;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  marketValue: number;
  totalCost: number;
  gainLoss: number;
  gainLossPercent: number;
}


export interface OrderRequest {
  symbol: SupportedSymbol;
  side: "buy" | "sell";
  quantity: number;
  orderType: "market";
}

export interface Order {
  id: string;
  symbol: SupportedSymbol;
  side: "buy" | "sell";
  quantity: number;
  filledPrice: number;
  status: "filled" | "pending" | "cancelled";
  createdAt: string;
}

export interface User {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
}
