"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { currencySymbol } from "@/lib/currency";
import { voidObligation } from "@/lib/actions/obligations";
import type { PaymentObligation, Payment } from "@/lib/types";

type Props = {
  orphans: Array<{
    obligation: PaymentObligation;
    verifiedTotal: number;
    payments: Payment[];
  }>;
  isAdmin: boolean;
};

export function ReissuedPanel({ orphans, isAdmin }: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  if (orphans.length === 0 || !isAdmin) return null;

  const handleVoid = (id: string) =>
    startTransition(async () => {
      const r = await voidObligation({
        obligationId: id,
        reason: "Reissued; orphan voided by admin",
      });
      if (r.error) toast.error(r.error);
      else toast.success("Obligation voided.");
    });

  return (
    <div className="border border-warn/40 bg-warn/5 mb-6">
      <div className="px-5 py-3 border-b border-warn/30">
        <div className="label-sm-wide text-warn">REISSUED · NEEDS ADMIN ATTENTION</div>
        <p className="text-[12px] text-fg-2 mt-1 leading-[1.5]">
          These superseded obligations have verified payments that did not auto-pair to the
          new schedule. Void to write off, or contact the debtor to reconcile.
        </p>
      </div>
      {orphans.map(({ obligation, verifiedTotal, payments }) => {
        const symbol = currencySymbol(obligation.currency);
        return (
          <div
            key={obligation.id}
            className="px-5 py-3 border-b border-warn/20 last:border-b-0"
          >
            <div className="grid grid-cols-[1fr_auto] gap-3 items-baseline">
              <div className="text-[14px]">
                <span className="font-medium">{obligation.debtor_name_snapshot}</span>
                <span className="text-fg-3"> → </span>
                <span className="font-medium">{obligation.creditor_name_snapshot}</span>
                <span className="text-fg-3"> · {obligation.due_date ?? "no date"}</span>
              </div>
              <div className="font-mono text-[12px] tabular-nums">
                {symbol}{verifiedTotal.toFixed(2)} verified · was {symbol}
                {Number(obligation.amount).toFixed(2)}
              </div>
            </div>
            <div className="text-[11px] text-fg-3 font-mono uppercase tracking-[0.05em] mt-1">
              {payments.length} payment{payments.length === 1 ? "" : "s"} attached
            </div>
            <div className="mt-2 flex gap-2">
              <Button onClick={() => handleVoid(obligation.id)} disabled={pending}>
                Void this obligation
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
