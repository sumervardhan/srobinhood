-- CreateTable
CREATE TABLE "SimulationSnapshot" (
    "symbol" TEXT NOT NULL,
    "tradingDate" TEXT NOT NULL,
    "deltaPercents" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulationSnapshot_pkey" PRIMARY KEY ("symbol")
);
