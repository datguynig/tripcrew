"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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

  const { error } = await supabase.from("destination_candidates").insert({
    trip_id: parsed.data.tripId,
    title: parsed.data.title,
    note: parsed.data.note || null,
    proposed_by: user.id,
    position,
    mapbox_id: parsed.data.mapboxId ?? null,
    longitude: parsed.data.longitude ?? null,
    latitude: parsed.data.latitude ?? null,
    country: parsed.data.country ?? null,
  });
  if (error) return { error: error.message };

  await revalidateTrip(parsed.data.tripId);
  return { ok: true };
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
    .update({ status: "planning", destination: null })
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

export async function lockDestination(tripId: string) {
  const parsed = z.string().uuid().safeParse(tripId);
  if (!parsed.success) return { error: "Invalid trip" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: member } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", parsed.data)
    .eq("user_id", user.id)
    .maybeSingle<{ role: "admin" | "member" }>();
  if (member?.role !== "admin") return { error: "Admin only" };

  const service = createServiceClient();
  const { data: candidates } = await service
    .from("destination_candidates")
    .select("id, title, position")
    .eq("trip_id", parsed.data)
    .order("position", { ascending: true });

  if (!candidates || candidates.length === 0) {
    return { error: "Add at least one candidate before locking" };
  }

  const { data: votes } = await service
    .from("destination_votes")
    .select("candidate_id, vote")
    .in(
      "candidate_id",
      candidates.map((c) => c.id),
    );

  const scored = candidates
    .map((c) => {
      const vs = votes?.filter((v) => v.candidate_id === c.id) ?? [];
      const yes = vs.filter((v) => v.vote === "yes").length;
      const maybe = vs.filter((v) => v.vote === "maybe").length;
      return { ...c, score: yes * 2 + maybe };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.position - b.position;
    });

  const winner = scored[0];

  const { data: trip, error: updErr } = await service
    .from("trips")
    .update({ status: "locked", destination: winner.title })
    .eq("id", parsed.data)
    .eq("status", "planning")
    .select("slug")
    .maybeSingle<{ slug: string }>();
  if (updErr) return { error: updErr.message };
  if (!trip) return { error: "Destination already locked" };

  revalidatePath(`/trips/${trip.slug}`);
  revalidatePath(`/trips/${trip.slug}/destinations`);
  // No server-side redirect here — the client navigates after firing
  // the "undo" toast, so the toast registers before the route swap.
  return { ok: true as const, slug: trip.slug };
}
