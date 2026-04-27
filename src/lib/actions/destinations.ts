"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  createNotifications,
  tripMemberIdsExcept,
} from "@/lib/notifications";
import { enrichPlace } from "@/lib/placeEnrichment";
import { generateLockAndDraft } from "@/lib/actions/lockAndDraft";
import { preferencesSchema } from "@/lib/validators/aiPreferences";
import type { AiPreferences, TripMeta } from "@/lib/types";

async function revalidateTrip(tripId: string) {
  const service = createServiceClient();
  const { data } = await service
    .from("trips")
    .select("slug")
    .eq("id", tripId)
    .maybeSingle<{ slug: string }>();
  if (data?.slug) {
    revalidatePath(`/trips/${data.slug}/destinations`);
    revalidatePath(`/trips/${data.slug}`);
  }
}

const proposeSchema = z.object({
  tripId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  note: z.string().trim().max(280).optional().nullable(),
  mapboxId: z.string().trim().min(1).max(200).optional().nullable(),
  longitude: z.number().finite().gte(-180).lte(180).optional().nullable(),
  latitude: z.number().finite().gte(-90).lte(90).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
});

export async function proposeCandidate(input: {
  tripId: string;
  title: string;
  note?: string | null;
  mapboxId?: string | null;
  longitude?: number | null;
  latitude?: number | null;
  country?: string | null;
}) {
  const parsed = proposeSchema.safeParse(input);
  if (!parsed.success) return { error: "Title required (≤120 chars)" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: last } = await supabase
    .from("destination_candidates")
    .select("position")
    .eq("trip_id", parsed.data.tripId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>();

  const position = (last?.position ?? 0) + 1;

  const { data: inserted, error } = await supabase
    .from("destination_candidates")
    .insert({
      trip_id: parsed.data.tripId,
      title: parsed.data.title,
      note: parsed.data.note || null,
      proposed_by: user.id,
      position,
      mapbox_id: parsed.data.mapboxId ?? null,
      longitude: parsed.data.longitude ?? null,
      latitude: parsed.data.latitude ?? null,
      country: parsed.data.country ?? null,
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) return { error: error.message };

  await revalidateTrip(parsed.data.tripId);
  await fanOutCandidateProposed(
    parsed.data.tripId,
    user.id,
    parsed.data.title,
  );

  // Fire-and-forget place enrichment. Runs after the response is
  // sent (Vercel waitUntil), so propose stays snappy. Realtime
  // delivers the photo_url update to the clients.
  if (
    inserted?.id &&
    parsed.data.latitude !== null &&
    parsed.data.latitude !== undefined &&
    parsed.data.longitude !== null &&
    parsed.data.longitude !== undefined
  ) {
    const candidateId = inserted.id;
    const latitude = parsed.data.latitude;
    const longitude = parsed.data.longitude;
    after(async () => {
      const result = await enrichPlace({
        name: parsed.data.title,
        latitude,
        longitude,
        radiusMeters: 50_000,
      });
      if (!result.photoUrl) return;
      const service = createServiceClient();
      await service
        .from("destination_candidates")
        .update({
          photo_url: result.photoUrl,
          photo_attribution: result.photoAttribution,
        })
        .eq("id", candidateId);
    });
  }

  return { ok: true };
}

async function fanOutCandidateProposed(
  tripId: string,
  actorId: string,
  candidateTitle: string,
) {
  const service = createServiceClient();
  const [{ data: actor }, { data: trip }, recipients] = await Promise.all([
    service
      .from("profiles")
      .select("name")
      .eq("id", actorId)
      .maybeSingle<{ name: string }>(),
    service
      .from("trips")
      .select("name, slug")
      .eq("id", tripId)
      .maybeSingle<{ name: string; slug: string }>(),
    tripMemberIdsExcept(tripId, actorId),
  ]);
  await createNotifications({
    tripId,
    actorId,
    kind: "candidate_proposed",
    payload: {
      actor_name: actor?.name,
      trip_name: trip?.name,
      trip_slug: trip?.slug,
      candidate_title: candidateTitle,
    },
    recipients,
  });
}

export async function removeCandidate(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid id" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("destination_candidates")
    .delete()
    .eq("id", parsed.data)
    .select("trip_id")
    .maybeSingle<{ trip_id: string }>();
  if (error) return { error: error.message };
  if (!data) return { error: "Could not remove — not found or not permitted" };
  await revalidateTrip(data.trip_id);
  return { ok: true };
}

const voteSchema = z.object({
  candidateId: z.string().uuid(),
  vote: z.enum(["yes", "maybe", "no"]).nullable(),
});

export async function castDestinationVote(input: {
  candidateId: string;
  vote: "yes" | "maybe" | "no" | null;
}) {
  const parsed = voteSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid vote" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  if (parsed.data.vote === null) {
    const { error } = await supabase
      .from("destination_votes")
      .delete()
      .eq("candidate_id", parsed.data.candidateId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("destination_votes").upsert(
      {
        candidate_id: parsed.data.candidateId,
        user_id: user.id,
        vote: parsed.data.vote,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "candidate_id,user_id" },
    );
    if (error) return { error: error.message };
  }

  const { data: cand } = await supabase
    .from("destination_candidates")
    .select("trip_id")
    .eq("id", parsed.data.candidateId)
    .maybeSingle<{ trip_id: string }>();
  if (cand) await revalidateTrip(cand.trip_id);
  return { ok: true };
}

const unlockSchema = z.object({
  tripId: z.string().uuid(),
  // When true, wipe AI-drafted content (hero, spec_grid, schedule,
  // ai_drafted activities + bookings, ai_drafted_at). Keeps
  // ai_preferences — they're durable context for a re-draft.
  reset: z.boolean().optional(),
});

export async function unlockDestination(
  input: string | { tripId: string; reset?: boolean },
) {
  const normalized =
    typeof input === "string" ? { tripId: input } : input;
  const parsed = unlockSchema.safeParse(normalized);
  if (!parsed.success) return { error: "Invalid trip" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: member } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", parsed.data.tripId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: "admin" | "member" }>();
  if (member?.role !== "admin") return { error: "Admin only" };

  const service = createServiceClient();

  if (parsed.data.reset) {
    // Load current meta so we can selectively clear spec_grid + schedule
    // while preserving section_leads + ai_preferences (durable context).
    const { data: current } = await service
      .from("trips")
      .select("meta")
      .eq("id", parsed.data.tripId)
      .maybeSingle<{ meta: Record<string, unknown> | null }>();
    const meta = { ...(current?.meta ?? {}) } as Record<string, unknown>;
    delete meta.spec_grid;
    delete meta.schedule;

    const { data: trip, error } = await service
      .from("trips")
      .update({
        status: "planning",
        destination: null,
        hero_title: null,
        hero_subtitle: null,
        hero_image_url: null,
        hero_image_attribution: null,
        hero_tint: null,
        ai_drafted_at: null,
        meta,
      })
      .eq("id", parsed.data.tripId)
      .eq("status", "locked")
      .select("slug")
      .maybeSingle<{ slug: string }>();
    if (error) return { error: error.message };
    if (!trip) return { error: "Trip isn't locked" };

    // Nuke AI-drafted rows so the new destination doesn't inherit
    // Stockholm's activities/bookings.
    await service
      .from("activities")
      .delete()
      .eq("trip_id", parsed.data.tripId)
      .eq("ai_drafted", true);
    await service
      .from("bookings")
      .delete()
      .eq("trip_id", parsed.data.tripId)
      .eq("ai_drafted", true);

    revalidatePath(`/trips/${trip.slug}`);
    revalidatePath(`/trips/${trip.slug}/destinations`);
    revalidatePath(`/trips/${trip.slug}/shortlist`);
    revalidatePath(`/trips/${trip.slug}/bookings`);
    return { ok: true as const, reset: true };
  }

  const { data: trip, error } = await service
    .from("trips")
    .update({
      status: "planning",
      destination: null,
      hero_image_url: null,
      hero_image_attribution: null,
      hero_tint: null,
    })
    .eq("id", parsed.data.tripId)
    .eq("status", "locked")
    .select("slug")
    .maybeSingle<{ slug: string }>();
  if (error) return { error: error.message };
  if (!trip) return { error: "Trip isn't locked" };

  revalidatePath(`/trips/${trip.slug}`);
  revalidatePath(`/trips/${trip.slug}/destinations`);
  return { ok: true as const, reset: false };
}

const lockAndDraftSchema = z.object({
  tripId: z.string().uuid(),
  preferences: preferencesSchema,
  autoDraft: z.boolean(),
});

/**
 * Atomic Lock & Draft action — saves the trip's AI preferences, locks
 * the destination, and (when autoDraft) kicks off `generateLockAndDraft`
 * via Vercel `after()` so the response returns fast and the user lands
 * on the trip overview while the AI is still working in the background.
 */
export async function lockAndStartDraft(input: {
  tripId: string;
  preferences: AiPreferences;
  autoDraft: boolean;
}): Promise<
  | { ok: true; slug: string }
  | { ok: false; error: string }
> {
  const parsed = lockAndDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }
  const { tripId, preferences, autoDraft } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: member } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle<{ role: "admin" | "member" }>();
  if (member?.role !== "admin")
    return { ok: false, error: "Admin only." };

  const service = createServiceClient();

  // Pick the winner the same way `lockDestination` does — highest
  // (yes*2 + maybe), tiebreak by position.
  const { data: candidates } = await service
    .from("destination_candidates")
    .select(
      "id, title, position, latitude, longitude, photo_url, photo_attribution",
    )
    .eq("trip_id", tripId)
    .order("position", { ascending: true });

  if (!candidates || candidates.length === 0) {
    return { ok: false, error: "Add at least one candidate before locking." };
  }

  const { data: votes } = await service
    .from("destination_votes")
    .select("candidate_id, vote")
    .in("candidate_id", candidates.map((c) => c.id));

  const winner = candidates
    .map((c) => {
      const vs = votes?.filter((v) => v.candidate_id === c.id) ?? [];
      const yes = vs.filter((v) => v.vote === "yes").length;
      const maybe = vs.filter((v) => v.vote === "maybe").length;
      return { ...c, score: yes * 2 + maybe };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.position - b.position;
    })[0];

  // Same hero enrichment / tint extraction as lockDestination.
  let heroUrl = winner.photo_url;
  let heroAttribution = winner.photo_attribution;
  let heroTint: string | null = null;
  if (
    !heroUrl &&
    winner.latitude !== null &&
    winner.longitude !== null
  ) {
    const result = await enrichPlace({
      name: winner.title,
      latitude: winner.latitude,
      longitude: winner.longitude,
      radiusMeters: 50_000,
    });
    heroUrl = result.photoUrl;
    heroAttribution = result.photoAttribution;
    heroTint = result.tint;
  } else if (
    heroUrl &&
    winner.latitude !== null &&
    winner.longitude !== null
  ) {
    const result = await enrichPlace({
      name: winner.title,
      latitude: winner.latitude,
      longitude: winner.longitude,
      radiusMeters: 50_000,
    });
    heroTint = result.tint;
  }

  // Read existing meta so we preserve any non-AI fields when we merge
  // ai_preferences in.
  const { data: existing } = await service
    .from("trips")
    .select("meta")
    .eq("id", tripId)
    .maybeSingle<{ meta: TripMeta | null }>();

  const mergedMeta: TripMeta = {
    ...(existing?.meta ?? {}),
    ai_preferences: preferences,
    brief_updated_at: new Date().toISOString(),
  };

  const { data: trip, error: updErr } = await service
    .from("trips")
    .update({
      status: "locked",
      destination: winner.title,
      hero_image_url: heroUrl,
      hero_image_attribution: heroAttribution,
      hero_tint: heroTint,
      meta: mergedMeta,
    })
    .eq("id", tripId)
    .eq("status", "planning")
    .select("slug, name")
    .maybeSingle<{ slug: string; name: string }>();
  if (updErr) return { ok: false, error: updErr.message };
  if (!trip) return { ok: false, error: "Destination already locked." };

  revalidatePath(`/trips/${trip.slug}`);
  revalidatePath(`/trips/${trip.slug}/destinations`);

  // Same notification fan-out as lockDestination.
  const [{ data: actor }, recipients] = await Promise.all([
    service
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle<{ name: string }>(),
    tripMemberIdsExcept(tripId, user.id),
  ]);
  await createNotifications({
    tripId,
    actorId: user.id,
    kind: "destination_locked",
    payload: {
      actor_name: actor?.name,
      trip_name: trip.name,
      trip_slug: trip.slug,
      destination: winner.title,
    },
    recipients,
  });

  // Fire the AI draft in the background. Response returns now;
  // realtime delivers the populated draft to the client when ready.
  if (autoDraft) {
    after(async () => {
      try {
        await generateLockAndDraft({ tripId, userId: user.id });
      } catch (err) {
        console.error("lockAndStartDraft after() draft failed:", err);
      }
    });
  }

  return { ok: true, slug: trip.slug };
}
