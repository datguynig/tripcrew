"use client";

import { useState, useTransition } from "react";
import { recordPayment, verifyPayment, rejectPayment, voidPayment } from "@/lib/actions/payments";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { currencySymbol } from "@/lib/currency";
import { INPUT_SM } from "@/lib/styles";
import type { PaymentObligation, Payment, PaymentStatus } from "@/lib/types";

type Props = {
  obligation: PaymentObligation;
  payments: Payment[];
  currentUserId: string;
  isAdmin: boolean;
};

const STATUS_TONE: Record<PaymentStatus, string> = {
  pending: "text-warn",
  verified: "text-ok",
  rejected: "text-err",
  voided: "text-fg-3 line-through",
};

export function ObligationRow({ obligation, payments, currentUserId, isAdmin }: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [showRecord, setShowRecord] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const symbol = currencySymbol(obligation.currency);

  const verifiedSum = payments
    .filter((p) => p.status === "verified")
    .reduce((s, p) => s + Number(p.amount), 0);
  const pendingSum = payments
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + Number(p.amount), 0);
  const owed = Number(obligation.amount);
  const settled = verifiedSum >= owed;

  const canRecord =
    !settled &&
    (currentUserId === obligation.debtor_id || currentUserId === obligation.creditor_id);

  const handleRecord = () => {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    setAmount("");
    setNote("");
    setShowRecord(false);
    startTransition(async () => {
      const result = await recordPayment({
        obligationId: obligation.id,
        amount: Math.round(n * 100) / 100,
        note: note.trim() || undefined,
      });
      if (result.error) toast.error(result.error);
      else toast.success("Payment recorded.");
    });
  };

  const handleVerify = (id: string) =>
    startTransition(async () => {
      const r = await verifyPayment(id);
      if (r.error) toast.error(r.error);
    });

  const handleReject = (id: string) =>
    startTransition(async () => {
      const r = await rejectPayment({ paymentId: id });
      if (r.error) toast.error(r.error);
    });

  const handleVoid = (id: string) =>
    startTransition(async () => {
      const r = await voidPayment({ paymentId: id });
      if (r.error) toast.error(r.error);
    });

  return (
    <div
      className={`grid gap-2 px-5 py-4 border-b border-line last:border-b-0 ${
        settled ? "opacity-60" : ""
      }`}
    >
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-baseline">
        <div className="text-[14px]">
          <span className="font-medium">{obligation.debtor_name_snapshot}</span>
          <span className="text-fg-3"> → </span>
          <span className="font-medium">{obligation.creditor_name_snapshot}</span>
        </div>
        <div className="font-mono text-[13px] tabular-nums">
          {symbol}{owed.toLocaleString()}
        </div>
        <div className="font-mono text-[10px] tracking-[0.08em] uppercase text-fg-3">
          {settled
            ? "SETTLED ✓"
            : `${symbol}${verifiedSum.toLocaleString()} of ${symbol}${owed.toLocaleString()}`}
        </div>
      </div>

      {pendingSum > 0 && !settled && (
        <div className="font-mono text-[10px] tracking-[0.08em] uppercase text-warn">
          {symbol}{pendingSum.toFixed(2)} pending verification
        </div>
      )}

      {canRecord && (
        <div>
          {!showRecord ? (
            <Button onClick={() => setShowRecord(true)} disabled={pending}>
              Mark paid
            </Button>
          ) : (
            <div className="grid grid-cols-[1fr_1fr_auto_auto] max-[640px]:grid-cols-[1fr_auto] max-[640px]:gap-y-2 gap-2">
              <input
                type="number"
                step="0.01"
                placeholder={`Amount (${symbol})`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${INPUT_SM} max-[640px]:col-span-2`}
                aria-label="Payment amount"
              />
              <input
                type="text"
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={`${INPUT_SM} max-[640px]:col-span-2`}
                aria-label="Payment note"
              />
              <Button onClick={handleRecord} disabled={pending}>Record</Button>
              <Button variant="icon" onClick={() => setShowRecord(false)} aria-label="Cancel">
                ✕
              </Button>
            </div>
          )}
        </div>
      )}

      {payments.length > 0 && (
        <div className="grid gap-1 pl-3 border-l border-line">
          {payments.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-[auto_1fr_auto] gap-2 items-baseline text-[12px]"
            >
              <span
                className={`font-mono text-[10px] tabular-nums uppercase ${STATUS_TONE[p.status]}`}
              >
                {p.status}
              </span>
              <span className="text-fg-2">
                {symbol}{Number(p.amount).toFixed(2)}
                {p.note && <span className="text-fg-3"> · {p.note}</span>}
                {p.rejection_note && <span className="text-err"> · {p.rejection_note}</span>}
              </span>
              <span className="flex gap-2 items-center">
                {p.status === "pending" && isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleVerify(p.id)}
                    disabled={pending}
                    className="label-sm py-1 text-fg-3 hover:text-ok transition-colors disabled:opacity-50"
                  >
                    verify
                  </button>
                )}
                {p.status === "pending" &&
                  (currentUserId === obligation.creditor_id || isAdmin) && (
                    <button
                      type="button"
                      onClick={() => handleReject(p.id)}
                      disabled={pending}
                      className="label-sm py-1 text-fg-3 hover:text-err transition-colors disabled:opacity-50"
                    >
                      reject
                    </button>
                  )}
                {(p.status === "pending" || p.status === "verified") &&
                  (p.recorded_by === currentUserId || isAdmin) && (
                    <Button
                      variant="icon"
                      onClick={() => handleVoid(p.id)}
                      aria-label="Void"
                      disabled={pending}
                    >
                      ✕
                    </Button>
                  )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
