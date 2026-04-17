"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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
});

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
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, startDate, endDate, voteDeadline, candidates } = parsed.data;

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
      meta: {},
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

  const candidateLines = (candidates ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (candidateLines.length > 0) {
    const rows = candidateLines.map((title, i) => ({
      trip_id: trip.id,
      title: title.slice(0, 120),
      proposed_by: user.id,
      position: i + 1,
    }));
    const { error: candErr } = await service
      .from("destination_candidates")
      .insert(rows);
    if (candErr) console.error("candidate insert error", candErr);
  }

  revalidatePath("/");
  redirect(`/trips/${trip.slug}/destinations`);
}
