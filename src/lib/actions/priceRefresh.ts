"use server";

import { canRefreshPrices } from "@/lib/gates";
import { getUserPlan } from "@/lib/plan";
import { logAiUsage } from "@/lib/ai/usage";
import { createClient } from "@/lib/supabase/server";

export type PriceRefreshResult =
  | { success: true; refreshedAt: string }
  | { success: false; error: string; upgradeCta: boolean };

export async function refreshPrices(
  userId: string,
  tripId: string,
): Promise<PriceRefreshResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    await logAiUsage({
      userId,
      tripId,
      feature: "price_refresh",
      model: "none",
      estimatedCostGBP: 0,
      succeeded: false,
      errorMessage: "Not signed in",
    });
    return { success: false, error: "Not signed in.", upgradeCta: false };
  }

  const gate = await canRefreshPrices(userId, tripId);
  if (!gate.allowed) {
    await logAiUsage({
      userId,
      tripId,
      feature: "price_refresh",
      model: "none",
      estimatedCostGBP: 0,
      succeeded: false,
      errorMessage: gate.reason,
    });
    return { success: false, error: gate.reason, upgradeCta: gate.upgrade_cta };
  }

  const userPlan = await getUserPlan(userId);
  const { error } = await supabase.rpc("record_price_refresh", {
    p_user_id: userId,
    p_trip_id: tripId,
    p_is_trial: userPlan === "trial",
  });

  if (error) {
    await logAiUsage({
      userId,
      tripId,
      feature: "price_refresh",
      model: "none",
      estimatedCostGBP: 0,
      succeeded: false,
      errorMessage: error.message,
    });
    return {
      success: false,
      error: "Price refresh could not be recorded.",
      upgradeCta: false,
    };
  }

  const refreshedAt = new Date().toISOString();
  await logAiUsage({
    userId,
    tripId,
    feature: "price_refresh",
    model: "none",
    estimatedCostGBP: 0,
    succeeded: true,
  });

  return { success: true, refreshedAt };
}
