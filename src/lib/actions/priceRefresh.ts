"use server";

import { revalidatePath } from "next/cache";
import { canRefreshPrices } from "@/lib/gates";
import { getUserPlan, isPioneerForTrip } from "@/lib/plan";
import { logAiUsage } from "@/lib/ai/usage";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { fetchFlightPrices, fetchHotelQuotes, serpApiEnabled } from "@/lib/serpapi/client";
import { checkSerpApiBudget } from "@/lib/serpapi/costCap";
import { resolveDestinationIata, resolveOriginIata } from "@/lib/iata";
import type { LivePricing, HotelPricing, FlightPricing, ErrorEnvelope, TripMeta } from "@/lib/types";

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
  target_budget_pp: number | null;
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

  const cap = await checkSerpApiBudget();
  if (!cap.allowed) {
    await logAiUsage({
      userId,
      tripId,
      feature: "price_refresh",
      model: "none",
      estimatedCostGBP: 0,
      succeeded: false,
      errorMessage: "monthly_budget_cap",
    });
    return {
      success: false,
      error: "Monthly pricing budget reached. Refresh disabled until next month.",
      upgradeCta: false,
    };
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select(
      "id, slug, destination, start_date, end_date, target_crew_size, target_budget_pp, currency, meta",
    )
    .eq("id", tripId)
    .maybeSingle<TripRow>();

  if (tripError || !trip) {
    console.warn("[priceRefresh] trip not found", { tripId, error: tripError });
    return { success: false, error: "Trip not found.", upgradeCta: false };
  }

  if (!trip.destination || !trip.start_date || !trip.end_date) {
    console.warn("[priceRefresh] trip incomplete", {
      tripId,
      destination: trip.destination,
      start_date: trip.start_date,
      end_date: trip.end_date,
    });
    return {
      success: false,
      error: "Lock the destination and dates before checking prices.",
      upgradeCta: false,
    };
  }

  const origin = trip.meta?.ai_preferences?.origin ?? null;
  const originIata = resolveOriginIata(origin);
  const destinationIata = resolveDestinationIata(trip.destination);

  if (!originIata) {
    console.warn("[priceRefresh] origin IATA unresolvable — skipping flights", { tripId, origin });
  }
  if (!destinationIata) {
    console.warn("[priceRefresh] destination IATA unresolvable — skipping flights", { tripId, destination: trip.destination });
  }

  const adults = Math.max(1, trip.target_crew_size ?? 1);
  const currency = trip.currency ?? "GBP";

  const tripDays = (() => {
    if (!trip.start_date || !trip.end_date) return null;
    const ms = Date.parse(trip.end_date) - Date.parse(trip.start_date);
    if (!Number.isFinite(ms) || ms < 0) return null;
    return Math.max(1, Math.round(ms / 86_400_000));
  })();
  const targetBudgetPp = trip.target_budget_pp ?? null;
  const perRoomBudget =
    targetBudgetPp && tripDays
      ? (targetBudgetPp * 0.4) / tripDays * 2
      : undefined;

  const rooms = Math.max(1, Math.ceil((trip.target_crew_size ?? 1) / 2));

  // Flights need IATA on both sides and a Pioneer subscription. Hotels
  // search by destination string and don't need IATA — they run for all
  // tiers. When IATA is missing or the user is on Member tier we skip the
  // flight call entirely.
  const isPioneer = await isPioneerForTrip(userId, tripId);
  const flightTask = (isPioneer && originIata && destinationIata)
    ? fetchFlightPrices({
        originIata,
        destinationIata,
        outboundDate: trip.start_date,
        returnDate: trip.end_date,
        adults,
        currency,
      })
    : Promise.resolve(null);

  const [flightResult, hotelResult] = await Promise.allSettled([
    flightTask,
    fetchHotelQuotes({
      destination: trip.destination,
      checkIn: trip.start_date,
      checkOut: trip.end_date,
      rooms,
      perRoomBudget,
      currency,
    }),
  ]);

  const refreshedAt = new Date().toISOString();
  const buildError = (
    code: ErrorEnvelope["code"],
    message: string,
  ): ErrorEnvelope => ({
    code,
    message,
    occurred_at: refreshedAt,
  });

  let flights: FlightPricing | undefined;
  let flightError: ErrorEnvelope | null = null;
  if (flightResult.status === "fulfilled" && flightResult.value) {
    // fulfilled only when flightTask was the real fetch (both IATA non-null)
    const fp = flightResult.value;
    flights = {
      low: Math.round(fp.low),
      high: Math.round(fp.high),
      currency: fp.currency,
      provider: "serpapi-google-flights",
      refreshed_at: refreshedAt,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      origin_iata: originIata!,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      destination_iata: destinationIata!,
      best_price: fp.best_price,
      options: fp.options,
      fetch_error: null,
    };
  } else if (flightResult.status === "rejected") {
    flightError = buildError("provider_error", String(flightResult.reason));
  } else if (!isPioneer) {
    // Member tier — flights weren't attempted. No error.
    flightError = null;
  } else if (!originIata) {
    flightError = buildError(
      "missing_input",
      "Couldn't resolve your origin airport. Set an origin in /admin → Trip preferences.",
    );
  } else if (!destinationIata) {
    flightError = buildError(
      "missing_input",
      `No IATA mapping for "${trip.destination}". Live flight pricing is limited to common destinations.`,
    );
  } else {
    flightError = buildError("no_results", "SerpApi returned no flights for this route + dates.");
  }

  let hotels: HotelPricing;
  if (hotelResult.status === "fulfilled" && hotelResult.value && hotelResult.value.length > 0) {
    hotels = {
      quotes: hotelResult.value,
      refreshed_at: refreshedAt,
      provider: "serpapi-google-hotels",
      fetch_error: null,
    };
  } else if (hotelResult.status === "rejected") {
    hotels = {
      quotes: [],
      refreshed_at: refreshedAt,
      provider: "serpapi-google-hotels",
      fetch_error: buildError("provider_error", String(hotelResult.reason)),
    };
  } else {
    hotels = {
      quotes: [],
      refreshed_at: refreshedAt,
      provider: "serpapi-google-hotels",
      fetch_error: buildError("no_results", "SerpApi returned no hotels."),
    };
  }

  if (flightError) {
    // Preserve previous live_pricing.flights if any, attach the per-side error.
    // If we never had IATA codes, keep flights undefined and let the UI
    // render the deeplink fallback rather than a phantom row.
    const prev = trip.meta?.live_pricing?.flights;
    if (prev) {
      flights = { ...prev, fetch_error: flightError };
    } else if (originIata && destinationIata) {
      flights = {
        low: 0,
        high: 0,
        currency,
        provider: "serpapi-google-flights",
        refreshed_at: refreshedAt,
        origin_iata: originIata,
        destination_iata: destinationIata,
        fetch_error: flightError,
      };
    }
    // else: leave flights undefined; UI shows deeplink fallback.
  }

  const livePricing: LivePricing = { flights, hotels };

  // If all attempted fetches failed, record the attempt (so the rate limit
  // advances) but signal failure to the user. For Member trips only hotels
  // are attempted, so hotel failure alone counts as all-failed.
  const hotelsFailed = hotels.fetch_error !== null;
  const flightsFailed = isPioneer && flightError !== null;
  const allAttemptedFailed = isPioneer ? hotelsFailed && flightsFailed : hotelsFailed;

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
    succeeded: !allAttemptedFailed,
    errorMessage: allAttemptedFailed
      ? `flights:${flightError?.code ?? "ok"};hotels:${hotels.fetch_error?.code ?? "ok"}`
      : undefined,
  });

  revalidatePath(`/trips/${trip.slug}`);

  if (allAttemptedFailed) {
    return {
      success: false,
      error: "Couldn't fetch fresh prices. Try again later.",
      upgradeCta: false,
    };
  }

  return { success: true, refreshedAt };
}
