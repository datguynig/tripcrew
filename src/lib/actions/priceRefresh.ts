"use server";

import { revalidatePath } from "next/cache";
import { canRefreshPrices } from "@/lib/gates";
import { getUserPlan } from "@/lib/plan";
import { logAiUsage } from "@/lib/ai/usage";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { fetchFlightPrices, serpApiEnabled } from "@/lib/serpapi/client";
import { resolveDestinationIata, resolveOriginIata } from "@/lib/iata";
import type { LivePricing, TripMeta } from "@/lib/types";

export type PriceRefreshResult =
  | { success: true; refreshedAt: string }
  | { success: false; error: string; upgradeCta: boolean };

type TripRow = {
  id: string;
  slug: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  target_crew_size: number | null;
  currency: string | null;
  meta: TripMeta | null;
};

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

  if (!serpApiEnabled()) {
    return {
      success: false,
      error: "Live pricing isn't configured. Admin needs to set SERPAPI_KEY.",
      upgradeCta: false,
    };
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select(
      "id, slug, destination, start_date, end_date, target_crew_size, currency, meta",
    )
    .eq("id", tripId)
    .maybeSingle<TripRow>();

  if (tripError || !trip) {
    return { success: false, error: "Trip not found.", upgradeCta: false };
  }

  if (!trip.destination || !trip.start_date || !trip.end_date) {
    return {
      success: false,
      error: "Lock the destination and dates before checking prices.",
      upgradeCta: false,
    };
  }

  const origin = trip.meta?.ai_preferences?.origin ?? null;
  const originIata = resolveOriginIata(origin);
  if (!originIata) {
    return {
      success: false,
      error:
        "Couldn't resolve your origin airport. Set an origin in /admin → Trip preferences.",
      upgradeCta: false,
    };
  }

  const destinationIata = resolveDestinationIata(trip.destination);
  if (!destinationIata) {
    return {
      success: false,
      error: `No IATA mapping for "${trip.destination}". Live pricing is limited to common destinations for now.`,
      upgradeCta: false,
    };
  }

  const adults = Math.max(1, trip.target_crew_size ?? 1);
  const currency = trip.currency ?? "GBP";

  const prices = await fetchFlightPrices({
    originIata,
    destinationIata,
    outboundDate: trip.start_date,
    returnDate: trip.end_date,
    adults,
    currency,
  });

  if (!prices) {
    await logAiUsage({
      userId,
      tripId,
      feature: "price_refresh",
      model: "none",
      estimatedCostGBP: 0,
      succeeded: false,
      errorMessage: "SerpApi returned no prices",
    });
    return {
      success: false,
      error:
        "No flights found for this route + dates. Try adjusting the trip dates.",
      upgradeCta: false,
    };
  }

  const userPlan = await getUserPlan(userId);
  const { error: rpcError } = await supabase.rpc("record_price_refresh", {
    p_user_id: userId,
    p_trip_id: tripId,
    p_is_trial: userPlan === "trial",
  });
  if (rpcError) {
    return {
      success: false,
      error: "Price refresh could not be recorded.",
      upgradeCta: false,
    };
  }

  const refreshedAt = new Date().toISOString();
  const livePricing: LivePricing = {
    flights: {
      low: Math.round(prices.low),
      high: Math.round(prices.high),
      currency: prices.currency,
      provider: "serpapi-google-flights",
      refreshed_at: refreshedAt,
      origin_iata: originIata,
      destination_iata: destinationIata,
    },
  };

  const nextMeta: TripMeta = {
    ...(trip.meta ?? {}),
    live_pricing: livePricing,
  };

  const service = await createServiceClient();
  const { error: updateError } = await service
    .from("trips")
    .update({ meta: nextMeta })
    .eq("id", tripId);

  if (updateError) {
    console.error("[priceRefresh] meta update failed", updateError);
    return {
      success: false,
      error: "Saved the refresh timestamp but couldn't persist prices.",
      upgradeCta: false,
    };
  }

  await logAiUsage({
    userId,
    tripId,
    feature: "price_refresh",
    model: "none",
    estimatedCostGBP: 0,
    succeeded: true,
  });

  revalidatePath(`/trips/${trip.slug}`);
  return { success: true, refreshedAt };
}
