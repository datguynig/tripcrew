import type { Schedule } from "@/lib/types";
import { applyRoundingRemainder } from "@/lib/ledger/shares";

export type ObligationRow = {
  trip_id: string;
  expense_id: string;
  expense_version: number;
  debtor_id: string;
  creditor_id: string;
  debtor_name_snapshot: string;
  creditor_name_snapshot: string;
  due_date: string | null;
  amount: number;
  currency: string;
  installment_index: number | null;
};

export function buildObligationRows(input: {
  expense_id: string;
  trip_id: string;
  payer_id: string;
  payer_name: string;
  expense_version: number;
  currency: string;
  participants: Array<{
    user_id: string;
    share_amount: number;
    display_name_snapshot: string;
  }>;
  schedule: Schedule;
}): ObligationRow[] {
  const nonPayer = input.participants.filter((p) => p.user_id !== input.payer_id);
  const baseRow = (
    debtor: typeof nonPayer[number],
    amount: number,
    due_date: string | null,
    installment_index: number | null,
  ): ObligationRow => ({
    trip_id: input.trip_id,
    expense_id: input.expense_id,
    expense_version: input.expense_version,
    debtor_id: debtor.user_id,
    creditor_id: input.payer_id,
    debtor_name_snapshot: debtor.display_name_snapshot,
    creditor_name_snapshot: input.payer_name,
    due_date,
    amount,
    currency: input.currency,
    installment_index,
  });

  if (input.schedule.type === "none") {
    return nonPayer.map((d) => baseRow(d, d.share_amount, null, null));
  }
  if (input.schedule.type === "single") {
    return nonPayer.map((d) => baseRow(d, d.share_amount, input.schedule.type === "single" ? input.schedule.due_date : null, null));
  }
  // installments
  const rows: ObligationRow[] = [];
  for (const debtor of nonPayer) {
    const raw = input.schedule.installments.map((i) =>
      Math.round(debtor.share_amount * i.fraction * 100) / 100,
    );
    const adjusted = applyRoundingRemainder(raw, debtor.share_amount);
    input.schedule.installments.forEach((i, idx) => {
      rows.push(baseRow(debtor, adjusted[idx], i.due_date, idx));
    });
  }
  return rows;
}
