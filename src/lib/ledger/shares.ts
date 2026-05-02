import type { ShareBasis } from "@/lib/types";

export type ShareInput = { user_id: string; input?: number };
export type ComputedShare = {
  user_id: string;
  share_amount: number;
  share_basis: ShareBasis;
  share_input: number | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function applyRoundingRemainder(
  shares: number[],
  total: number,
): number[] {
  if (shares.length === 0) return [];
  const sum = shares.reduce((s, n) => s + n, 0);
  const diff = round2(total - sum);
  if (diff === 0) return shares;
  const adjusted = shares.slice();
  adjusted[adjusted.length - 1] = round2(adjusted[adjusted.length - 1] + diff);
  return adjusted;
}

export function computeEqualShares(
  total: number,
  user_ids: string[],
): ComputedShare[] {
  if (user_ids.length === 0) return [];
  const per = round2(total / user_ids.length);
  const raw = user_ids.map(() => per);
  const adjusted = applyRoundingRemainder(raw, total);
  return user_ids.map((user_id, i) => ({
    user_id,
    share_amount: adjusted[i],
    share_basis: "equal",
    share_input: null,
  }));
}

export function computePercentageShares(
  total: number,
  inputs: { user_id: string; input: number }[],
): ComputedShare[] {
  if (inputs.length === 0) return [];
  const raw = inputs.map((i) => round2((total * i.input) / 100));
  const adjusted = applyRoundingRemainder(raw, total);
  return inputs.map((i, idx) => ({
    user_id: i.user_id,
    share_amount: adjusted[idx],
    share_basis: "percentage",
    share_input: i.input,
  }));
}

export function computeExactShares(
  inputs: { user_id: string; input: number }[],
): ComputedShare[] {
  return inputs.map((i) => ({
    user_id: i.user_id,
    share_amount: round2(i.input),
    share_basis: "exact",
    share_input: i.input,
  }));
}
