"use server";

import { createServiceClient } from "@/lib/supabase/server";

export type ClaimFoundingSeatResult =
  | { ok: true; reservationId: string }
  | { ok: false; error: "sold_out" | "invalid_draft" | "internal" };

const TOTAL_FOUNDING_SEATS = 500;

/**
 * Reserve one of the 500 Founding seats for the visitor behind a draft.
 * Calls the `reserve_founding_seat` RPC which holds a transaction-scoped
 * advisory lock — concurrent claims at the 500-seat boundary are
 * serialised, so the seat count cannot oversell.
 */
export async function claimFoundingSeat(
  draftLeadId: string,
): Promise<ClaimFoundingSeatResult> {
  if (!draftLeadId) return { ok: false, error: "invalid_draft" };

  const supabase = createServiceClient();

  const { data: draft, error: draftErr } = await supabase
    .from("draft_leads")
    .select("id")
    .eq("id", draftLeadId)
    .maybeSingle<{ id: string }>();

  if (draftErr) {
    console.error("claimFoundingSeat draft lookup failed", draftErr);
    return { ok: false, error: "internal" };
  }
  if (!draft) return { ok: false, error: "invalid_draft" };

  const { data, error } = await supabase.rpc("reserve_founding_seat", {
    p_draft_lead_id: draftLeadId,
  });

  if (error) {
    console.error("reserve_founding_seat RPC failed", error);
    return { ok: false, error: "internal" };
  }
  if (!data) return { ok: false, error: "sold_out" };

  return { ok: true, reservationId: data as string };
}

/**
 * 500 minus (consumed + active holds). Used by the day-7 nudge email
 * and the founding-checkout sold-out gate.
 */
export async function foundingSeatsRemaining(): Promise<number> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  // Two queries are simpler and just as fast as the OR-with-AND query
  // PostgREST forces — both branches hit the same partial index.
  const [{ count: consumedCount }, { count: activeCount }] = await Promise.all([
    supabase
      .from("founding_reservations")
      .select("id", { count: "exact", head: true })
      .eq("consumed", true),
    supabase
      .from("founding_reservations")
      .select("id", { count: "exact", head: true })
      .eq("consumed", false)
      .gt("expires_at", nowIso),
  ]);

  const claimed = (consumedCount ?? 0) + (activeCount ?? 0);
  return Math.max(0, TOTAL_FOUNDING_SEATS - claimed);
}
