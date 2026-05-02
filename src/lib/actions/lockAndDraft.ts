"use server";

// NOTE: maxDuration is set on the pages that invoke this action
// (/trips/[slug]/destinations/page.tsx and /trips/[slug]/page.tsx)
// since "use server" files can only export async functions.

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
import { vibePlacesQueries } from "@/lib/ai/vibeMap";
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
import { resolvePlaceNames, type ResolvedPlace } from "@/lib/places/resolveBatch";
import type {
  AiOccasion,
  AiPreferences,
  AiVibeTag,
  DraftProgress,
  DraftStage,
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
    // Prefer the admin's stated intent (target_crew_size from the
    // Lock & Draft dialog) over the actual trip_members row count.
    // The user picks "10+" expecting a 10-person plan; the count is 1
    // because no one's joined yet — that shouldn't shrink the draft.
    crewSize: trip.target_crew_size ?? crewCount ?? 1,
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

  const startedAt = new Date().toISOString();
  const writeProgress = async (
    stage: DraftStage,
    detail?: string,
  ): Promise<void> => {
    const progress: DraftProgress = { stage, startedAt };
    if (detail) progress.detail = detail;
    await supabase
      .from("trips")
      .update({
        meta: { ...(trip.meta ?? {}), draft_progress: progress },
      })
      .eq("id", tripId);
  };

  try {
    let draft: Draft;
    let placesCalls = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let durationMs = 0;
    let model = getGeminiModelName();
    // Spec B: populated during the enriched Gemini pass; consumed in the save block.
    let resolvedPlaces = new Map<string, ResolvedPlace>();
    let placeIdToData = new Map<string, { maps_url: string | null; website_url: string | null }>();

    if (tier === "enriched") {
      await writeProgress("places", "Pulling live places near " + ctx.destination);
      const enriched = await enrichDestination({
        destination: ctx.destination,
        vibeQueries: vibePlacesQueries(ctx.vibes),
      });
      placesCalls = enriched.placesCalls;

      await writeProgress("weather", `Checking weather for ${ctx.startDate}…${ctx.endDate}`);
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

      await writeProgress("drafting", "Drafting itinerary, hotels, and budget");
      // Retry on Zod failure; the wrapper feeds the validation error
      // back to Gemini on attempt 2 with explicit fix instructions.
      const result = await callWithRetryOnSchemaError(prompt, EnrichedDraftSchema);

      draft = result.data;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      durationMs = result.durationMs;
      model = result.model;

      // Spec B Step 2: collect every place name the AI emitted across schedule
      // + bookings, resolve to verified place_ids in one batch. Activities
      // use SetupActivitySchema which has no placeId; place enrichment for
      // activities is handled separately (backfill-media script).
      const allNames = new Set<string>();
      const enrichedDraft = draft as EnrichedDraft;
      for (const row of enrichedDraft.setup?.schedule ?? []) {
        for (const p of row.places ?? []) {
          if (p?.name) allNames.add(p.name);
        }
      }
      for (const b of enrichedDraft.setup?.bookings ?? []) {
        if (b.place_name) allNames.add(b.place_name);
      }

      const destLatLng = enriched.resolved?.location
        ? {
            lat: enriched.resolved.location.latitude,
            lng: enriched.resolved.location.longitude,
          }
        : null;

      if (destLatLng && allNames.size > 0) {
        try {
          resolvedPlaces = await resolvePlaceNames(
            Array.from(allNames),
            destLatLng,
            50_000,
          );
        } catch (err) {
          // Per spec §2.5 item 4: places resolution failure NEVER blocks the
          // draft save. Log and proceed with empty resolutions.
          console.error("[lockAndDraft] places resolution failed, continuing", err);
          await logAiUsage({
            userId,
            tripId,
            feature: "lock_and_draft_places_resolution",
            model: "google-places",
            estimatedCostGBP: 0,
            succeeded: false,
            errorMessage: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Build a map of placeId → { maps_url, website_url } for activity
      // enrichment. Only topAttractions are PlaceDetails (carry googleMapsUri
      // + websiteUri); the other collections are PlaceSummary and lack those
      // fields. SetupActivitySchema has no placeId field so this map is used
      // as a future hook; currently no setup activity references a placeId.
      for (const item of enriched.topAttractions ?? []) {
        if (!item.id || placeIdToData.has(item.id)) continue;
        placeIdToData.set(item.id, {
          maps_url: item.googleMapsUri ?? null,
          website_url: item.websiteUri ?? null,
        });
      }

      // Spec B Step 4: apply place resolution to schedule rows + strip prose URLs.
      const URL_RE = /https?:\/\/\S+/g;
      for (const row of enrichedDraft.setup?.schedule ?? []) {
        if (typeof row.body === "string") {
          row.body = row.body.replace(URL_RE, "").replace(/\s+/g, " ").trim();
        }
        if (Array.isArray(row.places)) {
          row.places = row.places.map((p) => {
            const r = p?.name ? resolvedPlaces.get(p.name.trim().toLowerCase()) : null;
            return {
              name: p.name,
              place_id: r?.place_id ?? null,
              maps_url: r?.maps_url ?? null,
              website_url: r?.website_url ?? null,
            };
          });
        }
      }

    } else {
      await writeProgress("drafting", "Drafting summary and themes");
      const prompt = buildBasicDraftPrompt(ctx);
      const result = await callWithRetryOnSchemaError(prompt, BasicDraftSchema);

      draft = result.data;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      durationMs = result.durationMs;
      model = result.model;
    }

    await writeProgress("saving", "Saving plan");

    const estimatedCostGBP = estimateGeminiCostGBP(inputTokens, outputTokens);
    const nowIso = new Date().toISOString();

    if (tier === "enriched") {
      const setup = (draft as EnrichedDraft).setup;
      // Drop draft_progress on success — the page will see "no progress
      // marker + enriched_draft_generated_at populated" and render the
      // finished plan.
      const { draft_progress: _drop, ...metaWithoutProgress } = trip.meta ?? {};
      void _drop;
      const nextMeta: TripMeta = {
        ...metaWithoutProgress,
        spec_grid: setup.specGrid,
        // Cast: schedule rows were mutated in-place above (Spec B Step 4)
        // to carry full ScheduleItemPlace entries; Zod's static type still
        // says { name: string }[] because that's the shape it validates.
        schedule: setup.schedule as unknown as TripMeta["schedule"],
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
        // SetupActivitySchema has no placeId; place enrichment for activities
        // runs via the backfill-media script. These fields are left null here.
        place_id: null as string | null,
        maps_url: null as string | null,
        website_url: null as string | null,
      }));
      if (activityRows.length > 0) {
        const { error: actErr } = await service
          .from("activities")
          .insert(activityRows);
        if (actErr) {
          console.error("[generateLockAndDraft] activities insert failed", actErr);
        }
      }

      // Spec B: preserve admin manual edits across regeneration. Snapshot
      // (lower-cased trimmed title) → { custom_url, assignee_id, done } for
      // existing AI-drafted bookings, merge them back into the new rows by
      // exact-title match after re-insert.
      const { data: existingAiBookings } = await service
        .from("bookings")
        .select("title, custom_url, assignee_id, done")
        .eq("trip_id", tripId)
        .eq("ai_drafted", true);

      const bookingSnapshot = new Map<
        string,
        { custom_url: string | null; assignee_id: string | null; done: boolean }
      >();
      for (const b of existingAiBookings ?? []) {
        bookingSnapshot.set((b.title ?? "").toLowerCase().trim(), {
          custom_url: b.custom_url ?? null,
          assignee_id: b.assignee_id ?? null,
          done: !!b.done,
        });
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

      const bookingRows = setup.bookings.map((b, i) => {
        const r = b.place_name ? resolvedPlaces.get(b.place_name.trim().toLowerCase()) : null;
        const titleKey = (b.title ?? "").toLowerCase().trim();
        const preserved = bookingSnapshot.get(titleKey);
        return {
          trip_id: tripId,
          title: b.title,
          position: bookingBase + i,
          created_by: userId,
          ai_drafted: true,
          place_id: r?.place_id ?? null,
          maps_url: r?.maps_url ?? null,
          website_url: r?.website_url ?? null,
          custom_url: preserved?.custom_url ?? null,
          assignee_id: preserved?.assignee_id ?? null,
          done: preserved?.done ?? false,
        };
      });
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
    const service = await createServiceClient();
    await service.rpc("refund_generation_counters", {
      p_user_id: userId,
      p_trip_id: tripId,
      p_is_trial: userPlan === "trial",
    });

    // Surface the failure on the trips row so the client can render an
    // error state with a Retry button instead of just spinning.
    const friendlyMessage = classifyDraftError(err);
    const failedProgress: DraftProgress = {
      stage: "drafting",
      startedAt,
      error: { message: friendlyMessage, retryable: true },
    };
    await service
      .from("trips")
      .update({
        meta: { ...(trip.meta ?? {}), draft_progress: failedProgress },
      })
      .eq("id", tripId);

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

    console.error("[generateLockAndDraft] failed", {
      tripId,
      tripSlug: trip.slug,
      tier,
      model: getGeminiModelName(),
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });

    return {
      success: false,
      error: classifyDraftError(err),
      upgradeCta: false,
    };
  }
}

async function callWithRetryOnSchemaError<T extends z.ZodTypeAny>(
  prompt: string,
  schema: T,
): Promise<{
  data: z.infer<T>;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  model: string;
}> {
  let lastErr: unknown;
  let lastErrMessage = "";
  let totalInput = 0;
  let totalOutput = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    // On retry, append the validation error to the prompt so Gemini knows
    // exactly which fields to fix. Empirically this is much more effective
    // than just running the same prompt again.
    const effectivePrompt =
      attempt === 0
        ? prompt
        : `${prompt}\n\nIMPORTANT: A previous attempt failed schema validation with these errors. Fix them carefully — match every required field name and type exactly as defined in the OUTPUT SCHEMA above. Some objects use \`title\` (e.g. setup.activities, setup.bookings) and others use \`name\` (e.g. itinerary activities, bookAhead). Do not rename fields; produce the exact field names the schema requires.\n\n${lastErrMessage.slice(0, 2000)}`;
    try {
      const result = await generateJson(effectivePrompt, (raw) =>
        schema.parse(raw),
      );
      return {
        data: result.data,
        inputTokens: totalInput + result.inputTokens,
        outputTokens: totalOutput + result.outputTokens,
        durationMs: result.durationMs,
        model: result.model,
      };
    } catch (err) {
      lastErr = err;
      const isZod = err instanceof Error && err.name === "ZodError";
      if (!isZod) throw err;
      lastErrMessage = err.message;
      console.warn(
        `[lockAndDraft] schema validation failed on attempt ${attempt + 1}, retrying with error feedback`,
      );
    }
  }
  throw lastErr;
}

function classifyDraftError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes("gemini_api_key not configured")) {
    return "Drafting is offline. Engineering has been notified.";
  }
  if (lower.includes("gemini returned non-json")) {
    return "The AI returned an unexpected format. Please retry.";
  }
  if (
    lower.includes("model") &&
    (lower.includes("not found") || lower.includes("not supported"))
  ) {
    return "The AI model is unavailable right now. Please retry shortly.";
  }
  if (lower.includes("zoderror") || (err instanceof Error && err.name === "ZodError")) {
    return "The AI's response did not match the expected shape. Please retry.";
  }
  if (lower.includes("rate") && lower.includes("limit")) {
    return "AI rate limit reached. Please wait 60 seconds and retry.";
  }
  if (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("econnreset")
  ) {
    return "Network blip reaching the AI. Please retry.";
  }

  return "Drafting failed. Please retry in a moment.";
}
