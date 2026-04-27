import { createClient } from "@/lib/supabase/server";

export type Plan = "pro" | "trial" | "free";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isPlan(value: unknown): value is Plan {
  return value === "pro" || value === "trial" || value === "free";
}

// Mirrors the `get_user_plan` Postgres RPC (which returns "pro" for both
// `active` and `trialing` Stripe statuses, plus the 7-day local trial via
// `trial_started_at`). Used by the team-share gate so a free crew member
// gets Pro coverage when any admin is paying — matches the marketing
// promise on /account ("Buy once for your crew").
function profileHasProAccess(profile: {
  stripe_subscription_status: string | null;
  trial_started_at: string | null;
}): boolean {
  if (
    profile.stripe_subscription_status === "active" ||
    profile.stripe_subscription_status === "trialing"
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
