import { createServiceClient } from "@/lib/supabase/server";

export type CapCheck =
  | { allowed: true; spendGbp: number; capGbp: number | null }
  | { allowed: false; code: "monthly_budget_cap"; spendGbp: number; capGbp: number };

type Input = { capGbp: number | null; spendGbp: number };

export function isUnderMonthlyCap(input: Input): Promise<CapCheck> {
  if (input.capGbp === null) {
    return Promise.resolve({ allowed: true, spendGbp: input.spendGbp, capGbp: null });
  }
  if (input.spendGbp >= input.capGbp) {
    return Promise.resolve({
      allowed: false,
      code: "monthly_budget_cap",
      spendGbp: input.spendGbp,
      capGbp: input.capGbp,
    });
  }
  return Promise.resolve({ allowed: true, spendGbp: input.spendGbp, capGbp: input.capGbp });
}

// Production helper: hits ai_usage to compute current month spend.
// Not unit-tested directly (DB call) — exercised via integration / smoke.
// Soft cap: aggregation isn't atomic, two concurrent drafts can both
// pass; overshoot by 1-3 calls × $0.015 is acceptable noise.
export async function checkSerpApiBudget(): Promise<CapCheck> {
  const cap = process.env.SERPAPI_MONTHLY_CAP_GBP;
  const capGbp = cap ? Number.parseFloat(cap) : null;
  if (capGbp !== null && !Number.isFinite(capGbp)) {
    console.warn("[serpapi.costCap] SERPAPI_MONTHLY_CAP_GBP is not a number; treating as no cap");
    return { allowed: true, spendGbp: 0, capGbp: null };
  }

  const service = await createServiceClient();
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  const { data, error } = await service
    .from("ai_usage")
    .select("estimated_cost_gbp, feature")
    .gte("created_at", since.toISOString());
  if (error) {
    console.error("[serpapi.costCap] failed to read ai_usage", error);
    return { allowed: true, spendGbp: 0, capGbp };
  }
  const spend = (data ?? [])
    .filter((r) => {
      const f = (r as { feature?: string | null }).feature ?? "";
      return f.startsWith("serpapi_") || f.startsWith("lock_and_draft_pricing_");
    })
    .reduce(
      (sum, r) =>
        sum + (Number((r as { estimated_cost_gbp?: number }).estimated_cost_gbp) || 0),
      0,
    );

  return isUnderMonthlyCap({ capGbp, spendGbp: spend });
}
