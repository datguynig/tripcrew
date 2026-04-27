"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { AiOccasion, TripMeta } from "@/lib/types";

const candidateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  mapboxId: z.string().trim().max(200).nullable().optional(),
  longitude: z.number().finite().gte(-180).lte(180).nullable().optional(),
  latitude: z.number().finite().gte(-90).lte(90).nullable().optional(),
  country: z.string().trim().max(100).nullable().optional(),
});

const occasionSchema = z.enum([
  "group_holiday",
  "birthday",
  "anniversary",
  "honeymoon",
  "babymoon",
  "engagement",
  "hen_do",
  "stag_do",
  "family",
  "graduation",
  "reunion",
  "corporate_retreat",
  "guys_trip",
  "girls_trip",
  "couples_trip",
]);

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(80),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  voteDeadline: z.string().optional().or(z.literal("")),
  candidates: z.string().optional(),
  occasion: occasionSchema.optional().or(z.literal("")),
  currency: z
    .enum(["GBP", "USD", "EUR", "SEK", "NOK", "DKK", "CHF", "JPY", "AUD", "CAD"])
    .optional()
    .or(z.literal("")),
});

function parseCandidates(raw: string | undefined) {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  // New-trip form sends JSON. If a caller ever POSTs plaintext (tests,
  // legacy bookmarks), fall back to newline-splitting.
  if (trimmed.startsWith("[")) {
    try {
      const parsed = z.array(candidateSchema).max(20).parse(JSON.parse(trimmed));
      return parsed;
    } catch {
      return [];
    }
  }
  return trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((title) => ({
      title: title.slice(0, 120),
      mapboxId: null,
      longitude: null,
      latitude: null,
      country: null,
    }));
}

export type CreateTripState = { error?: string } | undefined;

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

function randomSuffix(len = 4) {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function createTrip(
  _prev: CreateTripState,
  formData: FormData,
): Promise<CreateTripState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    voteDeadline: formData.get("voteDeadline"),
    candidates: formData.get("candidates"),
    occasion: formData.get("occasion"),
    currency: formData.get("currency"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, startDate, endDate, voteDeadline, candidates, occasion, currency } =
    parsed.data;

  if (startDate && endDate && endDate < startDate) {
    return { error: "End date must be after start date" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const base = slugify(name) || "trip";
  const service = createServiceClient();

  let slug = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${randomSuffix()}`;
    const { data: existing } = await service
      .from("trips")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!existing) {
      slug = candidate;
      break;
    }
  }
  if (!slug) return { error: "Could not generate unique slug" };

  const initialMeta: TripMeta = occasion
    ? {
        ai_preferences: {
          origin: null,
          crew_size: 0,
          budget_tier: "mid",
          budget_custom_pp: null,
          vibes: [],
          occasion: occasion as AiOccasion,
        },
      }
    : {};

  const { data: trip, error: tripErr } = await service
    .from("trips")
    .insert({
      slug,
      name,
      status: "planning",
      start_date: startDate || null,
      end_date: endDate || null,
      vote_deadline: voteDeadline || null,
      created_by: user.id,
      meta: initialMeta,
      currency: currency || "GBP",
    })
    .select("id, slug")
    .single<{ id: string; slug: string }>();

  if (tripErr || !trip) {
    console.error("trip insert error", tripErr);
    return { error: "Could not create trip" };
  }

  const { error: memberErr } = await service.from("trip_members").insert({
    trip_id: trip.id,
    user_id: user.id,
    role: "admin",
    invited_by: user.id,
  });
  if (memberErr) {
    console.error("member insert error", memberErr);
    return { error: "Could not add you as admin" };
  }

  const candidateRows = parseCandidates(candidates);
  if (candidateRows.length > 0) {
    const rows = candidateRows.map((c, i) => ({
      trip_id: trip.id,
      title: c.title.slice(0, 120),
      proposed_by: user.id,
      position: i + 1,
      mapbox_id: c.mapboxId ?? null,
      longitude: c.longitude ?? null,
      latitude: c.latitude ?? null,
      country: c.country ?? null,
    }));
    const { error: candErr } = await service
      .from("destination_candidates")
      .insert(rows);
    if (candErr) console.error("candidate insert error", candErr);
  }

  revalidatePath("/");
  redirect(`/trips/${trip.slug}/destinations`);
}
