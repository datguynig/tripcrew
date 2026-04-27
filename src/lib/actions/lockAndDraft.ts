"use server";

import { z } from "zod";
import { canGenerateDraft } from "@/lib/gates";
import { getUserPlan, hasProAccessForTrip } from "@/lib/plan";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { enrichDestination } from "@/lib/places/orchestrator";
import { getWeatherForecast } from "@/lib/weather/client";
import {
  buildBasicDraftPrompt,
  buildEnrichedDraftPrompt,
  type TripContext,
} from "@/lib/ai/prompts";
import {
  estimateGeminiCostGBP,
  generateJson,
  getGeminiModelName,
} from "@/lib/ai/gemini";
import {
  BasicDraftSchema,
  EnrichedDraftSchema,
  type Draft,
  type EnrichedDraft,
} from "@/lib/ai/schema";
import { logAiUsage } from "@/lib/ai/usage";
import { buildGoogleFlightsUrl } from "@/lib/deeplinks/builders";
import type {
  AiOccasion,
  AiPreferences,
  AiVibeTag,
  TripMeta,
  TripPin,
} from "@/lib/types";

export type LockAndDraftResult =
  | { success: true; draft: Draft; tier: "basic" | "enriched" }
  | { success: false; error: string; upgradeCta: boolean };

const inputSchema = z.object({
  userId: z.string().uuid(),
  tripId: z.string().uuid(),
});

type TripRow = {
  id: string;
  slug: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  currency: string | null;
  target_budget_pp: number | string | null;
  target_crew_size: number | null;
  meta: TripMeta | null;
};

function featureForTier(tier: "basic" | "enriched") {
  return tier === "enriched"
    ? "lock_and_draft_enriched"
    : "lock_and_draft_basic";
}

async function logFailedCall(params: {
  userId: string;
  tripId: string;
  tier?: "basic" | "enriched";
  errorMessage: string;
}) {
  await logAiUsage({
    userId: params.userId,
    tripId: params.tripId,
    feature: featureForTier(params.tier ?? "basic"),
    model: getGeminiModelName(),
    estimatedCostGBP: 0,
    succeeded: false,
    errorMessage: params.errorMessage,
  });
}

export async function generateLockAndDraft(
  rawInput: z.input<typeof inputSchema>,
): Promise<LockAndDraftResult> {
  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: "Invalid input.", upgradeCta: false };
  }

  const { userId, tripId } = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    await logFailedCall({ userId, tripId, errorMessage: "Not signed in" });
    return { success: false, error: "Not signed in.", upgradeCta: false };
  }

  const { data: member } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle<{ role: "admin" | "member" }>();

  if (!member) {
    await logFailedCall({ userId, tripId, errorMessage: "Trip not found" });
    return { success: false, error: "Trip not found.", upgradeCta: false };
  }

  const gate = await canGenerateDraft(userId, tripId);
  if (!gate.allowed) {
    await logFailedCall({ userId, tripId, errorMessage: gate.reason });
    return { success: false, error: gate.reason, upgradeCta: gate.upgrade_cta };
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select(
      "id, slug, name, destination, start_date, end_date, currency, target_budget_pp, target_crew_size, meta",
    )
    .eq("id", tripId)
    .maybeSingle<TripRow>();

  if (tripError || !trip) {
    await logFailedCall({ userId, tripId, errorMessage: "Trip not found" });
    return { success: false, error: "Trip not found.", upgradeCta: false };
  }

  if (!trip.destination || !trip.start_date || !trip.end_date) {
    const error = "Lock the destination and dates before generating a draft.";
    await logFailedCall({ userId, tripId, errorMessage: error });
    return { success: false, error, upgradeCta: false };
  }

  const { count: crewCount } = await supabase
    .from("trip_members")
    .select("user_id", { count: "exact", head: true })
    .eq("trip_id", tripId);

  const prefs: AiPreferences | undefined = trip.meta?.ai_preferences;
  const ctx: TripContext = {
    tripId: trip.id,
    destination: trip.destination,
    startDate: trip.start_date,
    endDate: trip.end_date,
    crewSize: crewCount ?? trip.target_crew_size ?? 1,
    currency: trip.currency ?? undefined,
    budgetPerPersonGBP:
      trip.target_budget_pp !== null ? Number(trip.target_budget_pp) : undefined,
    budgetTier: prefs?.budget_tier,
    origin: prefs?.origin?.name ?? undefined,
    notes: prefs?.notes,
    vibes: prefs?.vibes as AiVibeTag[] | undefined,
    occasion: prefs?.occasion as AiOccasion | undefined,
    pins: prefs?.pins as TripPin[] | undefined,
  };

  const tier: "basic" | "enriched" = (await hasProAccessForTrip(userId, tripId))
    ? "enriched"
    : "basic";
  const userPlan = await getUserPlan(userId);

  const increment = await supabase.rpc("increment_generation_counters", {
    p_user_id: userId,
    p_trip_id: tripId,
    p_is_trial: userPlan === "trial",
  });

  if (increment.error) {
    await logFailedCall({
      userId,
      tripId,
      tier,
      errorMessage: increment.error.message,
    });
    return {
      success: false,
      error: "Generation could not be reserved.",
      upgradeCta: false,
    };
  }

  try {
    let draft: Draft;
    let placesCalls = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let durationMs = 0;
    let model = getGeminiModelName();

    if (tier === "enriched") {
      const enriched = await enrichDestination({ destination: ctx.destination });
      placesCalls = enriched.placesCalls;

      const weather =
        enriched.resolved && ctx.startDate && ctx.endDate
          ? await getWeatherForecast(
              enriched.resolved.location.latitude,
              enriched.resolved.location.longitude,
              ctx.startDate,
              ctx.endDate,
            )
          : null;

      const flightSearchUrl = buildGoogleFlightsUrl({
        origin: ctx.origin,
        destination: ctx.destination,
        departDate: ctx.startDate,
        returnDate: ctx.endDate,
        adults: ctx.crewSize,
      });

      const prompt = buildEnrichedDraftPrompt(
        ctx,
        enriched,
        weather,
        flightSearchUrl,
      );
      const result = await generateJson(prompt, (raw) =>
        EnrichedDraftSchema.parse(raw),
      );

      draft = result.data;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      durationMs = result.durationMs;
      model = result.model;
    } else {
      const prompt = buildBasicDraftPrompt(ctx);
      const result = await generateJson(prompt, (raw) =>
        BasicDraftSchema.parse(raw),
      );

      draft = result.data;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      durationMs = result.durationMs;
      model = result.model;
    }

    const estimatedCostGBP = estimateGeminiCostGBP(inputTokens, outputTokens);
    const nowIso = new Date().toISOString();

    if (tier === "enriched") {
      const setup = (draft as EnrichedDraft).setup;
      const nextMeta: TripMeta = {
        ...(trip.meta ?? {}),
        spec_grid: setup.specGrid,
        schedule: setup.schedule,
      };

      const { error: updateError } = await supabase
        .from("trips")
        .update({
          enriched_draft: draft,
          enriched_draft_generated_at: nowIso,
          enriched_draft_tier: tier,
          hero_title: setup.heroTitle,
          hero_subtitle: setup.heroSubtitle,
          city_label: setup.cityLabel,
          dates_label: setup.datesLabel,
          ai_drafted_at: nowIso,
          meta: nextMeta,
        })
        .eq("id", tripId);

      if (updateError) throw updateError;

      const service = await createServiceClient();

      await service
        .from("activities")
        .delete()
        .eq("trip_id", tripId)
        .eq("ai_drafted", true);

      const { data: lastActivity } = await service
        .from("activities")
        .select("position")
        .eq("trip_id", tripId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle<{ position: number }>();
      const activityBase = (lastActivity?.position ?? 0) + 1;

      const activityRows = setup.activities.map((a, i) => ({
        trip_id: tripId,
        title: a.title,
        meta: a.meta ?? null,
        category: a.category,
        position: activityBase + i,
        ai_drafted: true,
      }));
      if (activityRows.length > 0) {
        const { error: actErr } = await service
          .from("activities")
          .insert(activityRows);
        if (actErr) {
          console.error("[generateLockAndDraft] activities insert failed", actErr);
        }
      }

      await service
        .from("bookings")
        .delete()
        .eq("trip_id", tripId)
        .eq("ai_drafted", true);

      const { data: lastBooking } = await service
        .from("bookings")
        .select("position")
        .eq("trip_id", tripId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle<{ position: number }>();
      const bookingBase = (lastBooking?.position ?? 0) + 1;

      const bookingRows = setup.bookings.map((b, i) => ({
        trip_id: tripId,
        title: b.title,
        position: bookingBase + i,
        created_by: userId,
        ai_drafted: true,
      }));
      if (bookingRows.length > 0) {
        const { error: bookErr } = await service
          .from("bookings")
          .insert(bookingRows);
        if (bookErr) {
          console.error("[generateLockAndDraft] bookings insert failed", bookErr);
        }
      }
    } else {
      const { error: updateError } = await supabase
        .from("trips")
        .update({
          enriched_draft: draft,
          enriched_draft_generated_at: nowIso,
          enriched_draft_tier: tier,
        })
        .eq("id", tripId);

      if (updateError) throw updateError;
    }

    await logAiUsage({
      userId,
      tripId,
      feature: featureForTier(tier),
      model,
      inputTokens,
      outputTokens,
      placesCalls,
      estimatedCostGBP,
      succeeded: true,
      durationMs,
    });

    return { success: true, draft, tier };
  } catch (err) {
    await supabase.rpc("refund_generation_counters", {
      p_user_id: userId,
      p_trip_id: tripId,
      p_is_trial: userPlan === "trial",
    });

    const message = err instanceof Error ? err.message : String(err);
    await logAiUsage({
      userId,
      tripId,
      feature: featureForTier(tier),
      model: getGeminiModelName(),
      estimatedCostGBP: 0,
      succeeded: false,
      errorMessage: message,
    });

    console.error("generateLockAndDraft failed:", err);
    return {
      success: false,
      error: "We could not generate a draft right now. Please try again in a minute.",
      upgradeCta: false,
    };
  }
}
