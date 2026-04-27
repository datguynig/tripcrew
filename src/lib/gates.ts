import { getUserPlan, hasProAccessForTrip, type Plan } from "@/lib/plan";
import { createClient } from "@/lib/supabase/server";

export const TRIAL_GENERATION_CAP = 3;
export const TRIAL_REFRESH_CAP = 10;
export const PRO_GENERATIONS_PER_TRIP_CAP = 10;
export const REFRESH_RATE_LIMIT_HOURS = 4;
export const FREE_GENERATIONS_PER_TRIP_CAP = 1;

export type GateResult =
  | { allowed: true }
  | { allowed: false; reason: string; upgrade_cta: boolean };

async function getEffectivePlan(userId: string, tripId: string): Promise<Plan> {
  const plan = await getUserPlan(userId);
  if (plan !== "free") return plan;
  return (await hasProAccessForTrip(userId, tripId)) ? "pro" : "free";
}

export async function canGenerateDraft(
  userId: string,
  tripId: string,
): Promise<GateResult> {
  const supabase = await createClient();
  const plan = await getEffectivePlan(userId, tripId);

  const { data: trip } = await supabase
    .from("trips")
    .select("ai_generations_count")
    .eq("id", tripId)
    .maybeSingle<{ ai_generations_count: number | null }>();

  if (!trip) {
    return { allowed: false, reason: "Trip not found.", upgrade_cta: false };
  }

  const count = trip.ai_generations_count ?? 0;

  if (plan === "free") {
    if (count >= FREE_GENERATIONS_PER_TRIP_CAP) {
      return {
        allowed: false,
        reason:
          "Free plan allows one draft per trip. Upgrade for live enrichment and regenerations.",
        upgrade_cta: true,
      };
    }
    return { allowed: true };
  }

  if (plan === "trial") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("trial_generations_used")
      .eq("id", userId)
      .maybeSingle<{ trial_generations_used: number | null }>();

    if ((profile?.trial_generations_used ?? 0) >= TRIAL_GENERATION_CAP) {
      return {
        allowed: false,
        reason: `Your trial includes ${TRIAL_GENERATION_CAP} AI drafts. Upgrade to Crew Plus for unlimited.`,
        upgrade_cta: true,
      };
    }
    return { allowed: true };
  }

  if (count >= PRO_GENERATIONS_PER_TRIP_CAP) {
    return {
      allowed: false,
      reason: `${PRO_GENERATIONS_PER_TRIP_CAP} drafts generated for this trip. Contact support if you need more.`,
      upgrade_cta: false,
    };
  }

  return { allowed: true };
}

export async function canDraftCandidates(
  userId: string,
  tripId: string,
): Promise<GateResult> {
  if (!(await hasProAccessForTrip(userId, tripId))) {
    return {
      allowed: false,
      reason:
        "Drafting plans for every candidate is a Crew Plus feature.",
      upgrade_cta: true,
    };
  }
  return { allowed: true };
}

export async function canRefreshPrices(
  userId: string,
  tripId: string,
): Promise<GateResult> {
  const supabase = await createClient();

  if (!(await hasProAccessForTrip(userId, tripId))) {
    return {
      allowed: false,
      reason: "Price refresh requires Crew Plus.",
      upgrade_cta: true,
    };
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("last_price_refresh_at, last_price_refresh_by")
    .eq("id", tripId)
    .maybeSingle<{
      last_price_refresh_at: string | null;
      last_price_refresh_by: string | null;
    }>();

  if (trip?.last_price_refresh_at) {
    const hoursSince =
      (Date.now() - Date.parse(trip.last_price_refresh_at)) / 3_600_000;
    if (hoursSince < REFRESH_RATE_LIMIT_HOURS) {
      const minutesLeft = Math.ceil(
        (REFRESH_RATE_LIMIT_HOURS - hoursSince) * 60,
      );
      return {
        allowed: false,
        reason: `Prices refreshed recently. Next refresh available in about ${minutesLeft} minutes.`,
        upgrade_cta: false,
      };
    }
  }

  const plan = await getUserPlan(userId);
  if (plan === "trial") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("trial_refreshes_used")
      .eq("id", userId)
      .maybeSingle<{ trial_refreshes_used: number | null }>();

    if ((profile?.trial_refreshes_used ?? 0) >= TRIAL_REFRESH_CAP) {
      return {
        allowed: false,
        reason: `Your trial includes ${TRIAL_REFRESH_CAP} refreshes. Upgrade for unlimited.`,
        upgrade_cta: true,
      };
    }
  }

  return { allowed: true };
}
