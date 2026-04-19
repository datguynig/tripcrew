"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  aiEnabled,
  draftReplacement,
  draftSurface,
  draftTrip,
  type DraftSurface,
  type ScheduleRow,
  type SpecCell,
} from "@/lib/ai";
import { placesEnabled } from "@/lib/places";
import { checkAiDraftRateLimit } from "@/lib/rateLimit";
import type { AiPreferences, Trip, TripMeta } from "@/lib/types";

/**
 * "Lock & draft" — one bundled AI pass that populates hero, spec grid,
 * schedule, activities, and bookings for a locked trip.
 *
 * Preconditions enforced here (server-trusted):
 *  - signed-in user is an admin member of the trip
 *  - profiles.ai_enabled = true
 *  - trip.status = 'locked' and trip.destination is set
 *  - rate limit budget available
 *  - GEMINI_API_KEY and GOOGLE_PLACES_API_KEY configured
 *
 * On success: activities and bookings rows get inserted with
 * ai_drafted=true, trip meta is filled in, ai_drafted_at is stamped,
 * ai_usage row is logged with token + cost breakdown.
 *
 * On failure: no partial trip state — ai_drafted_at stays null so the
 * CTA is still clickable for retry. Orphaned activity/booking rows
 * from a mid-write failure are acceptable for a closed beta; they can
 * be deleted by hand.
 */

const preferencesSchema = z.object({
  origin: z
    .object({
      name: z.string().trim().min(1).max(120),
      address: z.string().trim().max(200).nullable(),
      latitude: z.number().finite().gte(-90).lte(90).nullable(),
      longitude: z.number().finite().gte(-180).lte(180).nullable(),
      placeId: z.string().trim().max(200).nullable(),
      metro: z.string().trim().max(10).nullable().optional(),
      metroAirports: z.array(z.string().trim().max(10)).max(12).nullable().optional(),
    })
    .nullable(),
  crew_size: z.number().int().min(1).max(50),
  budget_tier: z.enum(["tight", "mid", "lavish", "custom"]),
  budget_custom_pp: z.number().finite().min(0).max(100_000).nullable(),
  vibes: z
    .array(
      z.enum([
        "chill",
        "active",
        "foodie",
        "nightlife",
        "culture",
        "outdoors",
        "beach",
      ]),
    )
    .max(7),
});

const inputSchema = z.object({
  tripId: z.string().uuid(),
  force: z.boolean().optional(),
  preferences: preferencesSchema.optional(),
  feedbackNote: z.string().trim().max(500).nullable().optional(),
});

export async function draftTripAction(input: {
  tripId: string;
  force?: boolean;
  preferences?: AiPreferences;
  feedbackNote?: string | null;
}) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  if (!aiEnabled()) return { error: "AI drafting is not configured" };
  if (!placesEnabled()) return { error: "Places lookup is not configured" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const [{ data: profile }, { data: member }, { data: trip }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("ai_enabled")
        .eq("id", user.id)
        .maybeSingle<{ ai_enabled: boolean }>(),
      supabase
        .from("trip_members")
        .select("role")
        .eq("trip_id", parsed.data.tripId)
        .eq("user_id", user.id)
        .maybeSingle<{ role: "admin" | "member" }>(),
      supabase
        .from("trips")
        .select("*")
        .eq("id", parsed.data.tripId)
        .maybeSingle<Trip>(),
    ]);

  if (!profile?.ai_enabled) return { error: "Not in the AI beta" };
  if (member?.role !== "admin") return { error: "Admins only" };
  if (!trip) return { error: "Trip not found" };
  if (trip.status !== "locked") {
    return { error: "Lock the destination first" };
  }
  if (!trip.destination) return { error: "Trip destination is empty" };

  if (trip.ai_drafted_at !== null && !parsed.data.force) {
    return { error: "Already drafted — pass force=true to redraft" };
  }

  const gate = await checkAiDraftRateLimit(createServiceClient(), {
    userId: user.id,
    tripId: trip.id,
  });
  if (!gate.ok) return { error: gate.reason };

  // Look up lat/lng for Places bias. Prefer the locked destination
  // candidate's coords (set at lock time from Mapbox) before falling
  // back to any candidate with coords.
  const { data: coords } = await supabase
    .from("destination_candidates")
    .select("longitude, latitude, title")
    .eq("trip_id", trip.id)
    .not("longitude", "is", null)
    .not("latitude", "is", null)
    .order("created_at", { ascending: true })
    .limit(10)
    .returns<
      Array<{ longitude: number; latitude: number; title: string }>
    >();

  const matched =
    (coords ?? []).find((c) => c.title === trip.destination) ?? coords?.[0];

  // Crew size — prefer the explicit target_crew_size; fall back to
  // current member count so the prompt has something to work with.
  const { count: crewCount } = await supabase
    .from("trip_members")
    .select("user_id", { count: "exact", head: true })
    .eq("trip_id", trip.id);

  const prefs = parsed.data.preferences ?? trip.meta?.ai_preferences ?? null;
  const effectiveCrewSize =
    prefs?.crew_size ?? trip.target_crew_size ?? crewCount ?? 4;
  const effectiveBudget =
    prefs?.budget_tier === "custom"
      ? (prefs.budget_custom_pp ?? trip.target_budget_pp)
      : prefs?.budget_tier === "tight"
        ? 400
        : prefs?.budget_tier === "lavish"
          ? 2500
          : prefs?.budget_tier === "mid"
            ? 950
            : trip.target_budget_pp;

  let result;
  try {
    result = await draftTrip({
      destination: trip.destination,
      destinationLatitude: matched?.latitude ?? null,
      destinationLongitude: matched?.longitude ?? null,
      startDate: trip.start_date,
      endDate: trip.end_date,
      crewSize: effectiveCrewSize,
      budgetPerHead: effectiveBudget,
      currency: trip.currency ?? "GBP",
      origin: prefs?.origin ?? null,
      budgetTier: prefs?.budget_tier ?? null,
      vibes: prefs?.vibes ?? [],
      feedbackNote: parsed.data.feedbackNote ?? null,
    });
  } catch (err) {
    console.error("[aiDraft] generation failed", err);
    return {
      error:
        err instanceof Error
          ? `AI draft failed: ${err.message}`
          : "AI draft failed",
    };
  }

  const service = createServiceClient();

  await service.from("ai_usage").insert({
    user_id: user.id,
    trip_id: trip.id,
    operation: "lock_and_draft",
    provider: result.usage.provider,
    model: result.usage.model,
    input_tokens: result.usage.inputTokens,
    output_tokens: result.usage.outputTokens,
    thinking_tokens: result.usage.thinkingTokens,
    ai_cost_usd: result.usage.aiCostUsd,
    places_requests: result.usage.placesRequests,
    places_cost_usd: result.usage.placesCostUsd,
    total_cost_usd: result.usage.totalCostUsd,
  });

  // A force-redraft replaces existing AI rows rather than stacking on
  // top of them. Manual rows (ai_drafted=false) are preserved.
  if (parsed.data.force) {
    await service
      .from("activities")
      .delete()
      .eq("trip_id", trip.id)
      .eq("ai_drafted", true);
    await service
      .from("bookings")
      .delete()
      .eq("trip_id", trip.id)
      .eq("ai_drafted", true);
  }

  const { data: lastActivity } = await service
    .from("activities")
    .select("position")
    .eq("trip_id", trip.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>();
  const activityBase = (lastActivity?.position ?? 0) + 1;

  const activityRows = result.draft.activities.map((a, i) => ({
    trip_id: trip.id,
    title: a.title,
    meta: a.meta || null,
    category: a.category,
    position: activityBase + i,
    ai_drafted: true,
  }));
  if (activityRows.length > 0) {
    const { error: actErr } = await service
      .from("activities")
      .insert(activityRows);
    if (actErr) console.error("[aiDraft] activities insert failed", actErr);
  }

  // Bookings — same append pattern.
  const { data: lastBooking } = await service
    .from("bookings")
    .select("position")
    .eq("trip_id", trip.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>();
  const bookingBase = (lastBooking?.position ?? 0) + 1;

  const bookingRows = result.draft.bookings.map((b, i) => ({
    trip_id: trip.id,
    title: b.title,
    position: bookingBase + i,
    created_by: user.id,
    ai_drafted: true,
  }));
  if (bookingRows.length > 0) {
    const { error: bookErr } = await service
      .from("bookings")
      .insert(bookingRows);
    if (bookErr) console.error("[aiDraft] bookings insert failed", bookErr);
  }

  // Trip hero + meta + ai_drafted_at — the atomic "done" marker.
  const nowIso = new Date().toISOString();
  const existingMeta: TripMeta = trip.meta ?? {};
  const nextMeta: TripMeta = {
    ...existingMeta,
    spec_grid: result.draft.spec_grid,
    schedule: result.draft.schedule,
    surface_drafted_at: {
      spec_grid: nowIso,
      schedule: nowIso,
      activities: nowIso,
      bookings: nowIso,
    },
    ...(prefs ? { ai_preferences: prefs } : {}),
  };

  const { error: tripErr } = await service
    .from("trips")
    .update({
      hero_title: result.draft.hero_title,
      hero_subtitle: result.draft.hero_subtitle,
      meta: nextMeta,
      ai_drafted_at: nowIso,
    })
    .eq("id", trip.id);

  if (tripErr) {
    console.error("[aiDraft] trip update failed", tripErr);
    return { error: "Draft generated but failed to save. Try again." };
  }

  revalidatePath(`/trips/${trip.slug}`);
  revalidatePath(`/trips/${trip.slug}/shortlist`);
  revalidatePath(`/trips/${trip.slug}/bookings`);

  return {
    ok: true as const,
    counts: {
      activities: activityRows.length,
      bookings: bookingRows.length,
    },
  };
}

const redraftSectionSchema = z.object({
  tripId: z.string().uuid(),
  surface: z.enum(["spec_grid", "schedule", "activities", "bookings"]),
  feedbackNote: z.string().trim().max(500).optional().nullable(),
});

export async function redraftSection(input: {
  tripId: string;
  surface: DraftSurface;
  feedbackNote?: string | null;
}) {
  const parsed = redraftSectionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  if (!aiEnabled()) return { error: "AI drafting is not configured" };
  if (!placesEnabled()) return { error: "Places lookup is not configured" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const [{ data: profile }, { data: member }, { data: trip }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("ai_enabled")
        .eq("id", user.id)
        .maybeSingle<{ ai_enabled: boolean }>(),
      supabase
        .from("trip_members")
        .select("role")
        .eq("trip_id", parsed.data.tripId)
        .eq("user_id", user.id)
        .maybeSingle<{ role: "admin" | "member" }>(),
      supabase
        .from("trips")
        .select("*")
        .eq("id", parsed.data.tripId)
        .maybeSingle<Trip>(),
    ]);

  if (!profile?.ai_enabled) return { error: "Not in the AI beta" };
  if (member?.role !== "admin") return { error: "Admins only" };
  if (!trip) return { error: "Trip not found" };
  if (trip.status !== "locked") return { error: "Lock the destination first" };
  if (!trip.destination) return { error: "Trip destination is empty" };
  if (trip.ai_drafted_at === null) {
    return { error: "Run the first draft before redrafting a section" };
  }

  const gate = await checkAiDraftRateLimit(createServiceClient(), {
    userId: user.id,
    tripId: trip.id,
  });
  if (!gate.ok) return { error: gate.reason };

  const { data: coords } = await supabase
    .from("destination_candidates")
    .select("longitude, latitude, title")
    .eq("trip_id", trip.id)
    .not("longitude", "is", null)
    .not("latitude", "is", null)
    .order("created_at", { ascending: true })
    .limit(10)
    .returns<
      Array<{ longitude: number; latitude: number; title: string }>
    >();
  const matched =
    (coords ?? []).find((c) => c.title === trip.destination) ?? coords?.[0];

  const { count: crewCount } = await supabase
    .from("trip_members")
    .select("user_id", { count: "exact", head: true })
    .eq("trip_id", trip.id);

  const prefs = trip.meta?.ai_preferences ?? null;
  const effectiveCrewSize =
    prefs?.crew_size ?? trip.target_crew_size ?? crewCount ?? 4;
  const effectiveBudget =
    prefs?.budget_tier === "custom"
      ? (prefs.budget_custom_pp ?? trip.target_budget_pp)
      : prefs?.budget_tier === "tight"
        ? 400
        : prefs?.budget_tier === "lavish"
          ? 2500
          : prefs?.budget_tier === "mid"
            ? 950
            : trip.target_budget_pp;

  const service = createServiceClient();
  const [{ data: currentActivities }, { data: currentBookings }] =
    await Promise.all([
      service
        .from("activities")
        .select("title, meta, category, ai_drafted")
        .eq("trip_id", trip.id)
        .order("position", { ascending: true })
        .returns<
          Array<{
            title: string;
            meta: string | null;
            category: "day" | "night";
            ai_drafted: boolean;
          }>
        >(),
      service
        .from("bookings")
        .select("title, ai_drafted")
        .eq("trip_id", trip.id)
        .order("position", { ascending: true })
        .returns<Array<{ title: string; ai_drafted: boolean }>>(),
    ]);

  let result;
  try {
    result = await draftSurface({
      surface: parsed.data.surface,
      ctx: {
        destination: trip.destination,
        destinationLatitude: matched?.latitude ?? null,
        destinationLongitude: matched?.longitude ?? null,
        startDate: trip.start_date,
        endDate: trip.end_date,
        crewSize: effectiveCrewSize,
        budgetPerHead: effectiveBudget,
        currency: trip.currency ?? "GBP",
        origin: prefs?.origin ?? null,
        budgetTier: prefs?.budget_tier ?? null,
        vibes: prefs?.vibes ?? [],
      },
      existing: {
        hero_title: trip.hero_title,
        hero_subtitle: trip.hero_subtitle,
        spec_grid: trip.meta?.spec_grid,
        schedule: trip.meta?.schedule,
        activities: currentActivities ?? undefined,
        bookings: currentBookings ?? undefined,
      },
      feedbackNote: parsed.data.feedbackNote ?? null,
    });
  } catch (err) {
    console.error("[redraftSection] generation failed", err);
    return {
      error:
        err instanceof Error
          ? `Redraft failed: ${err.message}`
          : "Redraft failed",
    };
  }

  await service.from("ai_usage").insert({
    user_id: user.id,
    trip_id: trip.id,
    operation: `redraft_${parsed.data.surface}`,
    provider: result.usage.provider,
    model: result.usage.model,
    input_tokens: result.usage.inputTokens,
    output_tokens: result.usage.outputTokens,
    thinking_tokens: result.usage.thinkingTokens,
    ai_cost_usd: result.usage.aiCostUsd,
    places_requests: result.usage.placesRequests,
    places_cost_usd: result.usage.placesCostUsd,
    total_cost_usd: result.usage.totalCostUsd,
  });

  const nowIso = new Date().toISOString();
  const existingMeta: TripMeta = trip.meta ?? {};
  const nextMeta: TripMeta = {
    ...existingMeta,
    surface_drafted_at: {
      ...(existingMeta.surface_drafted_at ?? {}),
      [result.surface]: nowIso,
    },
  };

  if (result.surface === "spec_grid") {
    nextMeta.spec_grid = result.value as SpecCell[];
  } else if (result.surface === "schedule") {
    nextMeta.schedule = result.value as ScheduleRow[];
  } else if (result.surface === "activities") {
    await service
      .from("activities")
      .delete()
      .eq("trip_id", trip.id)
      .eq("ai_drafted", true);
    const rows = result.value.map((a, i) => ({
      trip_id: trip.id,
      title: a.title,
      meta: a.meta || null,
      category: a.category,
      position: 1000 + i,
      ai_drafted: true,
    }));
    const { error: actErr } = await service.from("activities").insert(rows);
    if (actErr) {
      console.error("[redraftSection] activities insert failed", actErr);
      return { error: "Redraft generated but failed to save. Try again." };
    }
  } else {
    await service
      .from("bookings")
      .delete()
      .eq("trip_id", trip.id)
      .eq("ai_drafted", true);
    const rows = result.value.map((b, i) => ({
      trip_id: trip.id,
      title: b.title,
      position: 1000 + i,
      created_by: user.id,
      ai_drafted: true,
    }));
    const { error: bookErr } = await service.from("bookings").insert(rows);
    if (bookErr) {
      console.error("[redraftSection] bookings insert failed", bookErr);
      return { error: "Redraft generated but failed to save. Try again." };
    }
  }

  const { error: tripErr } = await service
    .from("trips")
    .update({ meta: nextMeta })
    .eq("id", trip.id);
  if (tripErr) {
    console.error("[redraftSection] trip update failed", tripErr);
    return { error: "Redraft generated but failed to save. Try again." };
  }

  if (parsed.data.feedbackNote && parsed.data.feedbackNote.trim()) {
    await service.from("ai_feedback").insert({
      trip_id: trip.id,
      user_id: user.id,
      surface:
        parsed.data.surface === "spec_grid" ? "hero_spec" : parsed.data.surface,
      rating: -1,
      note: parsed.data.feedbackNote.trim(),
    });
  }

  revalidatePath(`/trips/${trip.slug}`);
  revalidatePath(`/trips/${trip.slug}/shortlist`);
  revalidatePath(`/trips/${trip.slug}/bookings`);

  return {
    ok: true as const,
    surface: parsed.data.surface,
  };
}

const rerollRowSchema = z.object({
  tripId: z.string().uuid(),
  surface: z.enum(["activities", "bookings"]),
  rowId: z.string().uuid(),
});

export async function rerollRow(input: {
  tripId: string;
  surface: "activities" | "bookings";
  rowId: string;
}) {
  const parsed = rerollRowSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  if (!aiEnabled()) return { error: "AI drafting is not configured" };
  if (!placesEnabled()) return { error: "Places lookup is not configured" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const [{ data: profile }, { data: member }, { data: trip }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("ai_enabled")
        .eq("id", user.id)
        .maybeSingle<{ ai_enabled: boolean }>(),
      supabase
        .from("trip_members")
        .select("role")
        .eq("trip_id", parsed.data.tripId)
        .eq("user_id", user.id)
        .maybeSingle<{ role: "admin" | "member" }>(),
      supabase
        .from("trips")
        .select("*")
        .eq("id", parsed.data.tripId)
        .maybeSingle<Trip>(),
    ]);

  if (!profile?.ai_enabled) return { error: "Not in the AI beta" };
  if (member?.role !== "admin") return { error: "Admins only" };
  if (!trip) return { error: "Trip not found" };
  if (!trip.destination) return { error: "Trip destination is empty" };

  const gate = await checkAiDraftRateLimit(createServiceClient(), {
    userId: user.id,
    tripId: trip.id,
  });
  if (!gate.ok) return { error: gate.reason };

  const { data: coords } = await supabase
    .from("destination_candidates")
    .select("longitude, latitude, title")
    .eq("trip_id", trip.id)
    .not("longitude", "is", null)
    .not("latitude", "is", null)
    .limit(10)
    .returns<
      Array<{ longitude: number; latitude: number; title: string }>
    >();
  const matched =
    (coords ?? []).find((c) => c.title === trip.destination) ?? coords?.[0];

  const { count: crewCount } = await supabase
    .from("trip_members")
    .select("user_id", { count: "exact", head: true })
    .eq("trip_id", trip.id);
  const prefs = trip.meta?.ai_preferences ?? null;
  const effectiveCrewSize =
    prefs?.crew_size ?? trip.target_crew_size ?? crewCount ?? 4;
  const effectiveBudget =
    prefs?.budget_tier === "custom"
      ? (prefs.budget_custom_pp ?? trip.target_budget_pp)
      : prefs?.budget_tier === "tight"
        ? 400
        : prefs?.budget_tier === "lavish"
          ? 2500
          : prefs?.budget_tier === "mid"
            ? 950
            : trip.target_budget_pp;

  const service = createServiceClient();
  let replacing: string;
  let existingTitles: string[];
  let rowPosition: number;
  if (parsed.data.surface === "activities") {
    const { data: row } = await service
      .from("activities")
      .select("title, position, ai_drafted")
      .eq("id", parsed.data.rowId)
      .eq("trip_id", trip.id)
      .maybeSingle<{ title: string; position: number; ai_drafted: boolean }>();
    if (!row) return { error: "Row not found" };
    replacing = row.title;
    rowPosition = row.position;
    const { data: all } = await service
      .from("activities")
      .select("title")
      .eq("trip_id", trip.id)
      .returns<Array<{ title: string }>>();
    existingTitles = (all ?? []).map((a) => a.title);
  } else {
    const { data: row } = await service
      .from("bookings")
      .select("title, position, ai_drafted")
      .eq("id", parsed.data.rowId)
      .eq("trip_id", trip.id)
      .maybeSingle<{ title: string; position: number; ai_drafted: boolean }>();
    if (!row) return { error: "Row not found" };
    replacing = row.title;
    rowPosition = row.position;
    const { data: all } = await service
      .from("bookings")
      .select("title")
      .eq("trip_id", trip.id)
      .returns<Array<{ title: string }>>();
    existingTitles = (all ?? []).map((b) => b.title);
  }

  let result;
  try {
    result = await draftReplacement({
      surface: parsed.data.surface,
      ctx: {
        destination: trip.destination,
        destinationLatitude: matched?.latitude ?? null,
        destinationLongitude: matched?.longitude ?? null,
        startDate: trip.start_date,
        endDate: trip.end_date,
        crewSize: effectiveCrewSize,
        budgetPerHead: effectiveBudget,
        currency: trip.currency ?? "GBP",
        origin: prefs?.origin ?? null,
        budgetTier: prefs?.budget_tier ?? null,
        vibes: prefs?.vibes ?? [],
      },
      replacing,
      existingTitles,
    });
  } catch (err) {
    console.error("[rerollRow] generation failed", err);
    return {
      error:
        err instanceof Error
          ? `Re-roll failed: ${err.message}`
          : "Re-roll failed",
    };
  }

  await service.from("ai_usage").insert({
    user_id: user.id,
    trip_id: trip.id,
    operation: `reroll_${parsed.data.surface}`,
    provider: result.usage.provider,
    model: result.usage.model,
    input_tokens: result.usage.inputTokens,
    output_tokens: result.usage.outputTokens,
    thinking_tokens: result.usage.thinkingTokens,
    ai_cost_usd: result.usage.aiCostUsd,
    places_requests: result.usage.placesRequests,
    places_cost_usd: result.usage.placesCostUsd,
    total_cost_usd: result.usage.totalCostUsd,
  });

  if (result.surface === "activities") {
    const { error: upErr } = await service
      .from("activities")
      .update({
        title: result.value.title,
        meta: result.value.meta || null,
        category: result.value.category,
        ai_drafted: true,
      })
      .eq("id", parsed.data.rowId)
      .eq("trip_id", trip.id);
    if (upErr) {
      console.error("[rerollRow] activity update failed", upErr);
      return { error: "Re-roll generated but failed to save." };
    }
  } else {
    const { error: upErr } = await service
      .from("bookings")
      .update({
        title: result.value.title,
        ai_drafted: true,
      })
      .eq("id", parsed.data.rowId)
      .eq("trip_id", trip.id);
    if (upErr) {
      console.error("[rerollRow] booking update failed", upErr);
      return { error: "Re-roll generated but failed to save." };
    }
  }

  revalidatePath(`/trips/${trip.slug}`);
  revalidatePath(`/trips/${trip.slug}/shortlist`);
  revalidatePath(`/trips/${trip.slug}/bookings`);

  return {
    ok: true as const,
    surface: parsed.data.surface,
    newTitle: result.value.title,
  };
}

export async function getRedraftAvailability(tripId: string) {
  const parsed = z.string().uuid().safeParse(tripId);
  if (!parsed.success) return { ok: false as const, reason: "Invalid trip" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, reason: "Not signed in" };

  const { data: member } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", parsed.data)
    .eq("user_id", user.id)
    .maybeSingle<{ role: "admin" | "member" }>();
  if (member?.role !== "admin") {
    return { ok: false as const, reason: "Admins only" };
  }

  const verdict = await checkAiDraftRateLimit(createServiceClient(), {
    userId: user.id,
    tripId: parsed.data,
  });
  if (verdict.ok) return { ok: true as const };
  return { ok: false as const, reason: verdict.reason };
}

const feedbackSchema = z.object({
  tripId: z.string().uuid(),
  surface: z.enum(["schedule", "hero_spec", "activities", "bookings", "all"]),
  rating: z.union([z.literal(1), z.literal(-1)]).nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function submitAiFeedback(input: {
  tripId: string;
  surface: "schedule" | "hero_spec" | "activities" | "bookings" | "all";
  rating: 1 | -1 | null;
  note?: string | null;
}) {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid feedback" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("ai_feedback").insert({
    trip_id: parsed.data.tripId,
    user_id: user.id,
    surface: parsed.data.surface,
    rating: parsed.data.rating,
    note: parsed.data.note ?? null,
  });
  if (error) return { error: "Failed to save feedback" };

  return { ok: true as const };
}
