/**
 * Replay all of a user's orders and account transactions from scratch to derive
 * the correct current positions and spending power.
 *
 * Called after any backdated operation to keep the denormalized Position table
 * and User.spendingPower in sync with the canonical order/transaction history.
 */
import { PrismaClient } from "@prisma/client";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function reconcileCurrentState(userId: string, tx: TxClient) {
  const [allOrders, allTxns] = await Promise.all([
    tx.order.findMany({
      where: { userId, status: "filled" },
      orderBy: { createdAt: "asc" },
      select: { symbol: true, side: true, quantity: true, filledPrice: true },
    }),
    tx.accountTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { type: true, amount: true },
    }),
  ]);

  // Replay orders → final positions
  const positionMap = new Map<string, { quantity: number; avgCost: number }>();
  for (const o of allOrders) {
    const prev = positionMap.get(o.symbol) ?? { quantity: 0, avgCost: 0 };
    if (o.side === "buy") {
      const newQty = prev.quantity + o.quantity;
      const newAvg = (prev.avgCost * prev.quantity + o.filledPrice * o.quantity) / newQty;
      positionMap.set(o.symbol, { quantity: newQty, avgCost: newAvg });
    } else {
      const newQty = prev.quantity - o.quantity;
      if (newQty <= 0.0001) positionMap.delete(o.symbol);
      else positionMap.set(o.symbol, { quantity: newQty, avgCost: prev.avgCost });
    }
  }

  // Replay transactions → final cash
  let cash = 0;
  for (const tx_ of allTxns) {
    if (tx_.type === "deposit" || tx_.type === "sell") cash += tx_.amount;
    else if (tx_.type === "withdrawal" || tx_.type === "buy") cash -= tx_.amount;
  }

  // Validate: no position should be negative (indicates an invalid backdated sell)
  for (const [symbol, { quantity }] of positionMap) {
    if (quantity < -0.0001) {
      throw new Error(`Backdated sell would result in negative position for ${symbol}`);
    }
  }
  if (cash < -0.01) {
    throw new Error("Backdated operation would result in negative cash balance");
  }

  // Apply: wipe and recreate all positions
  await tx.position.deleteMany({ where: { userId } });
  if (positionMap.size > 0) {
    await tx.position.createMany({
      data: [...positionMap.entries()].map(([symbol, { quantity, avgCost }]) => ({
        userId,
        symbol,
        quantity: Math.round(quantity * 10000) / 10000,
        averageCost: Math.round(avgCost * 100) / 100,
      })),
    });
  }

  // Update spending power
  await tx.user.update({
    where: { id: userId },
    data: { spendingPower: Math.round(Math.max(0, cash) * 100) / 100 },
  });
}
