/**
 * Rate limits for AI operations during the closed beta.
 *
 * DB-backed via the existing `ai_usage` table — no extra storage.
 * Two rules, enforced independently:
 *   1. Per-trip: at most `MAX_DRAFTS_PER_TRIP_PER_DAY` drafts every 24h
 *   2. Per-user: at most `MAX_DRAFTS_PER_USER_PER_HOUR` drafts every 60m
 *
 * Guards against spam and holds beta spend in the expected range.
 * Call `checkAiDraftRateLimit` before any Gemini call; cheap enough
 * (one COUNT(*) with indexed predicates).
 *
 * **Always pass a service-role client.** `ai_usage` RLS limits visibility
 * to trip admins of the relevant trip. A user-scoped client would
 * under-count cross-trip usage when the caller isn't admin everywhere.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_DRAFTS_PER_TRIP_PER_DAY = 2;
export const MAX_DRAFTS_PER_USER_PER_HOUR = 1;

type Verdict =
  | { ok: true }
  | { ok: false; reason: string; retryAfterMinutes: number };

export async function checkAiDraftRateLimit(
  supabase: SupabaseClient,
  params: { userId: string; tripId: string },
): Promise<Verdict> {
  const { userId, tripId } = params;
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();

  const [{ count: tripCount }, { count: userCount }] = await Promise.all([
    supabase
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", tripId)
      .gte("created_at", dayAgo),
    supabase
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", hourAgo),
  ]);

  if ((tripCount ?? 0) >= MAX_DRAFTS_PER_TRIP_PER_DAY) {
    return {
      ok: false,
      reason: "This trip has already been drafted twice in the last 24 hours.",
      retryAfterMinutes: 60 * 24,
    };
  }
  if ((userCount ?? 0) >= MAX_DRAFTS_PER_USER_PER_HOUR) {
    return {
      ok: false,
      reason: "You've drafted a trip in the last hour. Try again in a bit.",
      retryAfterMinutes: 60,
    };
  }

  return { ok: true };
}
