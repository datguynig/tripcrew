type ObligationLite = {
  id: string;
  debtor_id: string;
  creditor_id: string;
  due_date: string | null;
  amount: number;
};

export type PairDecision =
  | { kind: "exact"; new_id: string }
  | { kind: "partial"; new_id: string; outstanding: number }
  | { kind: "overpayment"; new_id: string; excess: number }
  | { kind: "none" };

export function decidePair(input: {
  old: ObligationLite;
  candidate: ObligationLite;
  verified_paid_amount: number;
}): PairDecision {
  const { old, candidate, verified_paid_amount } = input;
  if (
    old.debtor_id !== candidate.debtor_id ||
    old.creditor_id !== candidate.creditor_id ||
    old.due_date !== candidate.due_date
  ) {
    return { kind: "none" };
  }
  const diff = candidate.amount - verified_paid_amount;
  if (Math.abs(diff) < 0.01) {
    return { kind: "exact", new_id: candidate.id };
  }
  if (diff > 0) {
    return { kind: "partial", new_id: candidate.id, outstanding: Math.round(diff * 100) / 100 };
  }
  return { kind: "overpayment", new_id: candidate.id, excess: Math.round(-diff * 100) / 100 };
}
