"use server";

// NOTE: maxDuration is set on the pages that invoke this action
// (/trips/[slug]/destinations/page.tsx and /trips/[slug]/page.tsx)
// since "use server" files can only export async functions.

import { z } from "zod";
import { after } from "next/server";
import { canGenerateDraft } from "@/lib/gates";
import { getUserPlan, hasProAccessForTrip, isPioneerForTrip } from "@/lib/plan";
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
import { fetchHotelQuotes, fetchFlightPrices, serpApiEnabled } from "@/lib/serpapi/client";
import { checkSerpApiBudget } from "@/lib/serpapi/costCap";
import { resolveOriginIata, resolveDestinationIata } from "@/lib/iata";
import type {
  AiOccasion,
  AiPreferences,
  AiVibeTag,
  DraftProgress,
  DraftStage,
  ErrorEnvelope,
  FlightPricing,
  HotelPricing,
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

    // Re-read meta to avoid clobbering concurrent writes (e.g. price
    // refresh racing in parallel). Last-writer-wins on draft_progress is
    // acceptable since progress is sequential within this action.
    const { data: latest } = await supabase
      .from("trips")
      .select("meta")
      .eq("id", tripId)
      .maybeSingle<{ meta: TripMeta | null }>();

    await supabase
      .from("trips")
      .update({
        meta: { ...(latest?.meta ?? {}), draft_progress: progress },
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
    // Hoisted so the post-Gemini resolution and the save block downstream
    // share scope; populated only on the enriched path.
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

      // One Places batch per draft: any name the AI mentions on schedule
      // or bookings becomes a verified place_id, or it's silently dropped.
      // Activities take a different path (backfill-media script) because
      // SetupActivitySchema has no placeId field.
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

      // Belt-and-braces: even though the prompt forbids inline URLs, strip
      // any that slip through before persisting. Pills come from the
      // structured `places` array, never from the body prose.
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
      // Re-read meta immediately before commit to avoid clobbering any
      // concurrent writes (price refresh, polaroid edits, brief edits).
      const { data: latestTrip } = await supabase
        .from("trips")
        .select("meta")
        .eq("id", tripId)
        .maybeSingle<{ meta: TripMeta | null }>();
      const currentMeta = latestTrip?.meta ?? trip.meta ?? {};
      // Drop draft_progress on success — the page will see "no progress
      // marker + enriched_draft_generated_at populated" and render the
      // finished plan.
      const { draft_progress: _drop, ...metaWithoutProgress } = currentMeta;
      void _drop;
      const nextMeta: TripMeta = {
        ...metaWithoutProgress,
        spec_grid: setup.specGrid,
        // Zod's inferred type for places is { name }[] — the validation
        // shape — but the runtime mutation above attaches place_id /
        // maps_url / website_url. The cast crosses that boundary.
        schedule: setup.schedule as unknown as TripMeta["schedule"],
        // On first lock: empty shell signals "loading" to realtime listeners.
        // On redraft: preserve existing pricing so a draft failure doesn't
        // wipe previously-fetched data.
        live_pricing: currentMeta.live_pricing ?? { flights: undefined, hotels: undefined },
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

      // Manual admin edits (custom_url, assignee, done) survive regeneration:
      // snapshot existing ai_drafted rows before delete, merge by exact-title
      // match after re-insert. Title rename loses the merge — accepted v1
      // trade-off; Levenshtein is a follow-up.
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

      // Non-blocking pricing fetch — runs after plan + bookings are committed
      // so SerpApi failures cannot poison the draft. Hotels run for any pro;
      // flights run only for Pioneer. Fire outside the response path via
      // after() so both lockAndStartDraft and direct DraftingFlow callers
      // are non-blocking.
      if (serpApiEnabled() && trip.start_date && trip.end_date && trip.destination) {
        after(async () => {
          try {
            const cap = await checkSerpApiBudget();
            if (!cap.allowed) {
              console.warn("[lockAndDraft] SerpApi monthly cap reached, skipping pricing");
              return;
            }
            await runPricingFetch({ userId, tripId, trip, tier: "enriched" });
          } catch (err) {
            console.error("[lockAndDraft.pricing] background pricing failed", err);
          }
        });
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
    // Re-read meta before writing the error state to avoid clobbering
    // any concurrent writes that happened before the failure.
    const { data: latestOnFailure } = await service
      .from("trips")
      .select("meta")
      .eq("id", tripId)
      .maybeSingle<{ meta: TripMeta | null }>();
    await service
      .from("trips")
      .update({
        meta: { ...(latestOnFailure?.meta ?? trip.meta ?? {}), draft_progress: failedProgress },
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

async function runPricingFetch(args: {
  userId: string;
  tripId: string;
  trip: {
    start_date: string | null;
    end_date: string | null;
    destination: string | null;
    target_crew_size: number | null;
    target_budget_pp?: number | string | null;
    currency: string | null;
    meta: TripMeta | null;
    slug?: string;
  };
  tier: "enriched";
}): Promise<void> {
  const { userId, tripId, trip } = args;
  if (!trip.start_date || !trip.end_date || !trip.destination) return;

  const tripDays = Math.max(
    1,
    Math.round((Date.parse(trip.end_date) - Date.parse(trip.start_date)) / 86_400_000),
  );
  const rooms = Math.max(1, Math.ceil((trip.target_crew_size ?? 1) / 2));
  const targetBudgetPp =
    trip.target_budget_pp !== null && trip.target_budget_pp !== undefined
      ? Number(trip.target_budget_pp)
      : null;
  const perRoomBudget =
    targetBudgetPp && tripDays
      ? (targetBudgetPp * 0.4) / tripDays * 2
      : undefined;
  const currency = trip.currency ?? "GBP";

  // Resolve Pioneer status and IATA codes before launching parallel fetches.
  const isPioneer = await isPioneerForTrip(userId, tripId);
  const originRaw = trip.meta?.ai_preferences?.origin ?? null;
  const originIata = resolveOriginIata(originRaw);
  const destinationIata = resolveDestinationIata(trip.destination);

  // Launch hotel and flight fetches in parallel. Flights only run for
  // Pioneer trips with resolvable IATA codes.
  const hotelTask = fetchHotelQuotes({
    destination: trip.destination,
    checkIn: trip.start_date,
    checkOut: trip.end_date,
    rooms,
    perRoomBudget,
    currency,
  }).catch((err) => {
    console.error("[lockAndDraft.pricing] hotels fetch threw", err);
    return null;
  });

  const flightTask =
    isPioneer && originIata && destinationIata
      ? fetchFlightPrices({
          originIata,
          destinationIata,
          outboundDate: trip.start_date,
          returnDate: trip.end_date,
          adults: Math.max(1, trip.target_crew_size ?? 1),
          currency,
        }).catch((err) => {
          console.error("[lockAndDraft.pricing] flights fetch threw", err);
          return null;
        })
      : Promise.resolve(null);

  const [hotelQuotes, flightResult] = await Promise.all([hotelTask, flightTask]);

  const refreshedAt = new Date().toISOString();
  const buildError = (code: ErrorEnvelope["code"], message: string): ErrorEnvelope => ({
    code,
    message,
    occurred_at: refreshedAt,
  });

  const hotels: HotelPricing =
    hotelQuotes && hotelQuotes.length > 0
      ? {
          quotes: hotelQuotes,
          refreshed_at: refreshedAt,
          provider: "serpapi-google-hotels",
          fetch_error: null,
        }
      : {
          quotes: [],
          refreshed_at: refreshedAt,
          provider: "serpapi-google-hotels",
          fetch_error: buildError("no_results", "SerpApi returned no hotels at draft time."),
        };

  let flights: FlightPricing | undefined;
  if (isPioneer && originIata && destinationIata && flightResult) {
    flights = {
      low: flightResult.low,
      high: flightResult.high,
      currency: flightResult.currency,
      provider: "serpapi-google-flights",
      refreshed_at: refreshedAt,
      origin_iata: originIata,
      destination_iata: destinationIata,
      best_price: flightResult.best_price,
      options: flightResult.options,
      fetch_error: null,
    };
  }

  // Persist the live_pricing into trips.meta. Re-read the latest meta
  // so we don't clobber other concurrent writes.
  const service = await createServiceClient();
  const { data: latest } = await service
    .from("trips")
    .select("meta")
    .eq("id", tripId)
    .maybeSingle<{ meta: TripMeta | null }>();
  const pricingMeta: TripMeta = {
    ...(latest?.meta ?? {}),
    live_pricing: { flights, hotels },
  };
  await service.from("trips").update({ meta: pricingMeta }).eq("id", tripId);

  await logAiUsage({
    userId,
    tripId,
    feature: "lock_and_draft_pricing_hotels",
    model: "serpapi",
    estimatedCostGBP: 0.012,
    succeeded: hotels.fetch_error === null,
    errorMessage: hotels.fetch_error?.message,
  });
  if (isPioneer) {
    await logAiUsage({
      userId,
      tripId,
      feature: "lock_and_draft_pricing_flights",
      model: "serpapi",
      estimatedCostGBP: 0.012,
      succeeded: !!flights && !flights.fetch_error,
      errorMessage: flights?.fetch_error?.message,
    });
  }
}
