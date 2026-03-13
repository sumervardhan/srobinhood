"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSpendingPower } from "@/hooks/useSpendingPower";
import { deposit, withdraw } from "@/lib/api";
import { CashModal } from "./CashModal";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function SpendingPowerCard() {
  const { data, isLoading } = useSpendingPower();
  const queryClient = useQueryClient();
  const [cashModal, setCashModal] = useState<"deposit" | "withdraw" | null>(null);

  const depositMutation = useMutation({
    mutationFn: deposit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio", "spending-power"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio", "transactions"] });
      setCashModal(null);
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: withdraw,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio", "spending-power"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio", "transactions"] });
      setCashModal(null);
    },
  });

  const spendingPower = data?.spendingPower ?? 0;

  return (
    <>
      <div className="rounded-xl bg-rh-card border border-rh-border p-4">
        <h3 className="text-sm font-medium text-rh-white mb-1">Spending Power</h3>
        <p className="text-2xl font-semibold text-rh-white font-mono mb-4">
          {isLoading ? "—" : formatCurrency(spendingPower)}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCashModal("deposit")}
            className="flex-1 py-2.5 rounded-xl bg-rh-green text-rh-black font-semibold text-sm hover:bg-green-400 transition-colors"
          >
            Deposit
          </button>
          <button
            type="button"
            onClick={() => setCashModal("withdraw")}
            className="flex-1 py-2.5 rounded-xl bg-rh-card border border-rh-border text-rh-white font-semibold text-sm hover:bg-rh-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={spendingPower <= 0}
          >
            Withdraw
          </button>
        </div>
      </div>

      {cashModal && (
        <CashModal
          type={cashModal}
          maxAmount={cashModal === "withdraw" ? spendingPower : undefined}
          onClose={() => setCashModal(null)}
          onSubmit={(amount) =>
            cashModal === "deposit"
              ? depositMutation.mutate(amount)
              : withdrawMutation.mutate(amount)
          }
          isPending={depositMutation.isPending || withdrawMutation.isPending}
          error={
            depositMutation.isError
              ? (depositMutation.error as Error)?.message
              : withdrawMutation.isError
                ? (withdrawMutation.error as Error)?.message
                : undefined
          }
        />
      )}
    </>
  );
}
