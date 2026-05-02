import { createClient } from "@/lib/supabase/server";

export type Plan = "pro" | "trial" | "free";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isPlan(value: unknown): value is Plan {
  return value === "pro" || value === "trial" || value === "free";
}

// Mirrors the `get_user_plan` Postgres RPC. Paid Stripe states are
// treated as Crew Plus access; `past_due` remains paid while Stripe's
// retry/dunning flow runs. The legacy 7-day local trial branch stays
// until old rows no longer rely on `trial_started_at`.
function profileHasProAccess(profile: {
  stripe_subscription_status: string | null;
  trial_started_at: string | null;
}): boolean {
  if (
    profile.stripe_subscription_status === "active" ||
    profile.stripe_subscription_status === "trialing" ||
    profile.stripe_subscription_status === "past_due"
  ) {
    return true;
  }
  if (!profile.trial_started_at) return false;
  return Date.parse(profile.trial_started_at) + SEVEN_DAYS_MS > Date.now();
}

export async function getUserPlan(userId: string): Promise<Plan> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_user_plan", {
    p_user_id: userId,
  });

  if (error) {
    console.error("getUserPlan failed:", error);
    return "free";
  }

  return isPlan(data) ? data : "free";
}

export async function hasProAccess(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId);
  return plan === "pro" || plan === "trial";
}

export async function hasProAccessForTrip(
  userId: string,
  tripId: string,
): Promise<boolean> {
  if (await hasProAccess(userId)) return true;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_members")
    .select(
      `
      user_id,
      profiles!inner (
        stripe_subscription_status,
        trial_started_at
      )
    `,
    )
    .eq("trip_id", tripId)
    .eq("role", "admin");

  if (error || !data) return false;

  return data.some((member) => {
    const profile = Array.isArray(member.profiles)
      ? member.profiles[0]
      : member.profiles;
    if (!profile) return false;
    return profileHasProAccess({
      stripe_subscription_status:
        typeof profile.stripe_subscription_status === "string"
          ? profile.stripe_subscription_status
          : null,
      trial_started_at:
        typeof profile.trial_started_at === "string"
          ? profile.trial_started_at
          : null,
    });
  });
}

// A trip is "Pioneer" iff at least one of its admins is a permanent
// founder (`profiles.is_founder = true`) OR has `founding_crew_at` set
// (i.e. completed founding-crew checkout). The two flags are separate
// columns: `is_founder` marks the founder account and is forever-true;
// `founding_crew_at` is stamped at checkout time for paid Pioneers.
// Either one grants Pioneer-tier UI for the trip.
//
// This matches the "any admin pays" pricing semantics used elsewhere —
// Pioneer status is a property of the trip, not of the caller. (A
// Pioneer who joins a non-Pioneer trip as a member should still see
// Member-tier UI for that trip.)
export async function isPioneerForTrip(
  userId: string,
  tripId: string,
): Promise<boolean> {
  // userId is kept for API stability; the check is trip-scoped only.
  void userId;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_members")
    .select(
      `
      user_id,
      profiles!inner (
        founding_crew_at,
        is_founder
      )
    `,
    )
    .eq("trip_id", tripId)
    .eq("role", "admin");

  if (error || !data) return false;

  return data.some((member) => {
    const p = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
    return !!p?.founding_crew_at || p?.is_founder === true;
  });
}
