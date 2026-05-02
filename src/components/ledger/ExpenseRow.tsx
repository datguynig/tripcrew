"use client";

import { Button } from "@/components/ui/Button";
import { EditIcon } from "@/components/ui/icons";
import { currencySymbol } from "@/lib/currency";
import type { Expense, ExpenseParticipant } from "@/lib/types";

type Props = {
  expense: Expense;
  participants: ExpenseParticipant[];
  payerName: string;
  currency: string;
  isMine: boolean;
  isAdmin: boolean;
  totalCrew: number;
  onDelete: () => void;
  onEdit: () => void;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    .toUpperCase();
}

function describeSplit(
  participants: ExpenseParticipant[],
  totalCrew: number
): string {
  if (participants.length === 0) return "No split";
  const allEqual =
    participants.every((p) => p.share_basis === "equal") &&
    participants.length === totalCrew;
  if (allEqual) {
    return `Split ${participants.length} ways`;
  }
  if (participants.every((p) => p.share_basis === "equal")) {
    return `${participants.length} of ${totalCrew}`;
  }
  return `${participants.length} of ${totalCrew} · weighted`;
}

export function ExpenseRow({
  expense,
  participants,
  payerName,
  currency,
  isMine,
  isAdmin,
  totalCrew,
  onDelete,
  onEdit,
}: Props) {
  const symbol = currencySymbol(currency);
  const split = describeSplit(participants, totalCrew);
  const isFx = !!expense.original_currency && !!expense.original_amount;

  return (
    <div
      className={`grid grid-cols-[70px_1fr_auto_36px] items-center py-[14px] px-6 border-b border-line last:border-b-0 gap-4 ${
        expense.deleted_at ? "opacity-50" : ""
      }`}
    >
      <div className="font-mono text-[11px] text-fg-3 tracking-[0.05em] uppercase">
        {formatDate(expense.created_at)}
      </div>
      <div>
        <div className="text-sm font-medium tracking-[-0.01em]">
          {expense.description}
        </div>
        <div className="font-mono text-[10px] text-fg-3 tracking-[0.08em] uppercase mt-[2px] flex items-baseline gap-2 flex-wrap">
          <span>BY {payerName}</span>
          <span aria-hidden>·</span>
          <span>{split}</span>
          {isFx && expense.fx_rate && (
            <>
              <span aria-hidden>·</span>
              <span className="text-accent">
                {currencySymbol(expense.original_currency!)}{Number(
                  expense.original_amount
                ).toLocaleString()}{" "}
                at {Number(expense.fx_rate).toFixed(4)}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="text-[17px] font-medium tracking-[-0.02em] tabular-nums">
        {symbol}
        {Math.round(Number(expense.amount)).toLocaleString()}
      </div>
      <div className="flex gap-1">
        {(isMine || isAdmin) && !expense.deleted_at && (
          <Button variant="icon" onClick={onEdit} aria-label="Edit expense">
            <EditIcon className="w-3.5 h-3.5" />
          </Button>
        )}
        {isMine && !expense.deleted_at && (
          <Button
            variant="icon"
            onClick={onDelete}
            aria-label="Delete expense"
            className="hover:text-err"
          >
            ✕
          </Button>
        )}
      </div>
    </div>
  );
}
