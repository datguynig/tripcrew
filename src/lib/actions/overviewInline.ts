"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTripMember } from "@/lib/auth";
import type {
  PolaroidOverride,
  ScheduleItem,
  SpecItem,
  TripMeta,
} from "@/lib/types";

async function gate(tripId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "Not signed in." };
  const member = await getTripMember(tripId, user.id);
  if (!member || member.role !== "admin") {
    return { ok: false as const, error: "Admin only." };
  }
  return { ok: true as const, userId: user.id };
}

async function readTrip(tripId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trips")
    .select("slug, meta, currency")
    .eq("id", tripId)
    .maybeSingle<{
      slug: string;
      meta: TripMeta | null;
      currency: string | null;
    }>();
  return { supabase, data };
}

function revalidateOverview(slug: string) {
  revalidatePath(`/trips/${slug}`);
  revalidatePath(`/trips/${slug}/admin`);
}

function withBriefBump(meta: TripMeta | null | undefined): TripMeta {
  return { ...(meta ?? {}), brief_updated_at: new Date().toISOString() };
}

const heroFieldSchema = z.object({
  tripId: z.string().uuid(),
  field: z.enum(["hero_title", "hero_subtitle"]),
  value: z.string().trim().max(300),
});

export async function updateHeroField(input: {
  tripId: string;
  field: "hero_title" | "hero_subtitle";
  value: string;
}) {
  const parsed = heroFieldSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const g = await gate(parsed.data.tripId);
  if (!g.ok) return { error: g.error };

  const max = parsed.data.field === "hero_title" ? 80 : 300;
  if (parsed.data.value.length > max) {
    return { error: `Max ${max} characters.` };
  }

  const { supabase, data } = await readTrip(parsed.data.tripId);
  if (!data) return { error: "Trip not found." };
  const nextMeta = withBriefBump(data.meta);

  const { error } = await supabase
    .from("trips")
    .update({
      [parsed.data.field]: parsed.data.value || null,
      meta: nextMeta,
    })
    .eq("id", parsed.data.tripId);

  if (error) return { error: "Could not save." };
  revalidateOverview(data.slug);
  return { ok: true as const };
}

const polaroidSlotSchema = z.object({
  tripId: z.string().uuid(),
  index: z.number().int().min(0).max(4),
  override: z
    .object({
      imageUrl: z.string().url(),
      caption: z.string().trim().max(60).nullable().optional(),
      subcaption: z.string().trim().max(60).nullable().optional(),
      sourceType: z.enum(["destination", "activity", "post", "upload"]),
      sourceId: z.string().nullable().optional(),
    })
    .nullable(),
});

export async function setPolaroidSlot(input: {
  tripId: string;
  index: number;
  override: {
    imageUrl: string;
    caption?: string | null;
    subcaption?: string | null;
    sourceType: "destination" | "activity" | "post" | "upload";
    sourceId?: string | null;
  } | null;
}) {
  const parsed = polaroidSlotSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const g = await gate(parsed.data.tripId);
  if (!g.ok) return { error: g.error };

  if (parsed.data.override) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const allowedPrefixes = [
      `${supabaseUrl}/storage/v1/object/public/trip-hero-images/`,
      `${supabaseUrl}/storage/v1/object/public/post-images/`,
      `${supabaseUrl}/storage/v1/object/public/place-photos/`,
    ];
    const inAllowed = allowedPrefixes.some((p) =>
      parsed.data.override!.imageUrl.startsWith(p),
    );
    if (!inAllowed) {
      return { error: "Image must live in a Yenkoh storage bucket." };
    }
  }

  const { supabase, data } = await readTrip(parsed.data.tripId);
  if (!data) return { error: "Trip not found." };

  const existing = data.meta?.polaroid_slots ?? [];
  const withoutIndex = existing.filter((s) => s.index !== parsed.data.index);
  const nextSlots: PolaroidOverride[] = parsed.data.override
    ? [
        ...withoutIndex,
        {
          index: parsed.data.index,
          imageUrl: parsed.data.override.imageUrl,
          caption: parsed.data.override.caption ?? null,
          subcaption: parsed.data.override.subcaption ?? null,
          sourceType: parsed.data.override.sourceType,
          sourceId: parsed.data.override.sourceId ?? null,
        },
      ]
    : withoutIndex;

  const nextMeta: TripMeta = { ...(data.meta ?? {}), polaroid_slots: nextSlots };

  const { error } = await supabase
    .from("trips")
    .update({ meta: nextMeta })
    .eq("id", parsed.data.tripId);
  if (error) return { error: "Could not save." };

  revalidateOverview(data.slug);
  return { ok: true as const };
}

import { DEFAULT_SPEC_LABELS } from "@/lib/constants";

function ensureSpecGrid(existing: SpecItem[] | undefined): SpecItem[] {
  if (existing && existing.length > 0) return existing;
  return DEFAULT_SPEC_LABELS.map((label) => ({ label, value: "", sub: "" }));
}

const specCellSchema = z.object({
  tripId: z.string().uuid(),
  index: z.number().int().min(0).max(3),
  patch: z.object({
    value: z.string().trim().max(80).optional(),
    sub: z.string().trim().max(60).optional(),
    amount: z
      .number()
      .finite()
      .min(0)
      .max(10_000_000)
      .nullable()
      .optional(),
  }),
});

export async function updateSpecCell(input: {
  tripId: string;
  index: number;
  patch: {
    value?: string;
    sub?: string;
    amount?: number | null;
  };
}) {
  const parsed = specCellSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const g = await gate(parsed.data.tripId);
  if (!g.ok) return { error: g.error };

  const { supabase, data } = await readTrip(parsed.data.tripId);
  if (!data) return { error: "Trip not found." };

  const current = ensureSpecGrid(data.meta?.spec_grid);
  const nextCell: SpecItem = {
    ...current[parsed.data.index],
    ...parsed.data.patch,
  };

  if (typeof parsed.data.patch.amount !== "undefined") {
    const a = parsed.data.patch.amount;
    nextCell.amount = a;
    if (a !== null) {
      nextCell.value = a.toLocaleString("en-US");
    }
  }

  const nextSpec = current.map((c, i) =>
    i === parsed.data.index ? nextCell : c,
  );
  const nextMeta: TripMeta = {
    ...withBriefBump(data.meta),
    spec_grid: nextSpec,
  };

  // Mirror the "Per head" spec cell into trips.target_budget_pp.
  // Both surface the same number (per-head budget) and the Hero stat
  // cell reads target_budget_pp directly — keeping them in sync here
  // is the only way to avoid a stale "target budget" above an edited
  // spec cell. Match on the canonical positional index (DEFAULT_SPEC_LABELS
  // has "Per head" at index 2) rather than a label string, so that AI
  // re-drafts with a slightly different label ("Per person", etc.)
  // don't silently desync the two surfaces.
  const PER_HEAD_INDEX = DEFAULT_SPEC_LABELS.indexOf("Per head");
  const update: Record<string, unknown> = { meta: nextMeta };
  const isPerHead =
    parsed.data.index === PER_HEAD_INDEX &&
    typeof parsed.data.patch.amount !== "undefined";
  if (isPerHead) {
    update.target_budget_pp = parsed.data.patch.amount;
  }

  const { error } = await supabase
    .from("trips")
    .update(update)
    .eq("id", parsed.data.tripId);
  if (error) return { error: "Could not save." };

  revalidateOverview(data.slug);
  return { ok: true as const };
}

const scheduleRowSchema = z.object({
  tripId: z.string().uuid(),
  index: z.number().int().min(0).max(19),
  patch: z.object({
    day_label: z.string().trim().max(30).optional(),
    heading: z.string().trim().max(120).optional(),
    body: z.string().trim().max(500).optional(),
  }),
});

export async function updateScheduleRow(input: {
  tripId: string;
  index: number;
  patch: { day_label?: string; heading?: string; body?: string };
}) {
  const parsed = scheduleRowSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const g = await gate(parsed.data.tripId);
  if (!g.ok) return { error: g.error };

  const { supabase, data } = await readTrip(parsed.data.tripId);
  if (!data) return { error: "Trip not found." };

  const rows = data.meta?.schedule ?? [];
  if (parsed.data.index >= rows.length) return { error: "Row not found." };
  const nextRow: ScheduleItem = {
    ...rows[parsed.data.index],
    ...parsed.data.patch,
  };
  const nextRows = rows.map((r, i) => (i === parsed.data.index ? nextRow : r));
  const nextMeta: TripMeta = {
    ...withBriefBump(data.meta),
    schedule: nextRows,
  };

  const { error } = await supabase
    .from("trips")
    .update({ meta: nextMeta })
    .eq("id", parsed.data.tripId);
  if (error) return { error: "Could not save." };

  revalidateOverview(data.slug);
  return { ok: true as const };
}

const reorderSchema = z.object({
  tripId: z.string().uuid(),
  from: z.number().int().min(0).max(19),
  to: z.number().int().min(0).max(19),
});

export async function reorderScheduleRow(input: {
  tripId: string;
  from: number;
  to: number;
}) {
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };
  if (parsed.data.from === parsed.data.to) return { ok: true as const };

  const g = await gate(parsed.data.tripId);
  if (!g.ok) return { error: g.error };

  const { supabase, data } = await readTrip(parsed.data.tripId);
  if (!data) return { error: "Trip not found." };

  const rows = [...(data.meta?.schedule ?? [])];
  if (parsed.data.from >= rows.length || parsed.data.to >= rows.length) {
    return { error: "Row index out of range." };
  }
  const [moved] = rows.splice(parsed.data.from, 1);
  rows.splice(parsed.data.to, 0, moved);
  const nextMeta: TripMeta = {
    ...withBriefBump(data.meta),
    schedule: rows,
  };

  const { error } = await supabase
    .from("trips")
    .update({ meta: nextMeta })
    .eq("id", parsed.data.tripId);
  if (error) return { error: "Could not save." };

  revalidateOverview(data.slug);
  return { ok: true as const };
}

const insertRowSchema = z.object({
  tripId: z.string().uuid(),
  index: z.number().int().min(0).max(20),
  row: z.object({
    day_label: z.string().trim().max(30),
    heading: z.string().trim().max(120),
    body: z.string().trim().max(500),
  }),
});

export async function insertScheduleRow(input: {
  tripId: string;
  index: number;
  row: { day_label: string; heading: string; body: string };
}) {
  const parsed = insertRowSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const g = await gate(parsed.data.tripId);
  if (!g.ok) return { error: g.error };

  const { supabase, data } = await readTrip(parsed.data.tripId);
  if (!data) return { error: "Trip not found." };

  const rows = [...(data.meta?.schedule ?? [])];
  const idx = Math.min(parsed.data.index, rows.length);
  rows.splice(idx, 0, parsed.data.row);
  const nextMeta: TripMeta = {
    ...withBriefBump(data.meta),
    schedule: rows,
  };

  const { error } = await supabase
    .from("trips")
    .update({ meta: nextMeta })
    .eq("id", parsed.data.tripId);
  if (error) return { error: "Could not save." };

  revalidateOverview(data.slug);
  return { ok: true as const };
}

const addRowSchema = z.object({ tripId: z.string().uuid() });

export async function addScheduleRow(tripId: string) {
  const parsed = addRowSchema.safeParse({ tripId });
  if (!parsed.success) return { error: "Invalid input." };

  const g = await gate(parsed.data.tripId);
  if (!g.ok) return { error: g.error };

  const { supabase, data } = await readTrip(parsed.data.tripId);
  if (!data) return { error: "Trip not found." };

  const rows = data.meta?.schedule ?? [];
  if (rows.length >= 20) return { error: "Max 20 days." };

  const next: ScheduleItem = {
    day_label: `Day ${rows.length + 1}`,
    heading: "",
    body: "",
  };
  const nextMeta: TripMeta = {
    ...withBriefBump(data.meta),
    schedule: [...rows, next],
  };

  const { error } = await supabase
    .from("trips")
    .update({ meta: nextMeta })
    .eq("id", parsed.data.tripId);
  if (error) return { error: "Could not save." };

  revalidateOverview(data.slug);
  return { ok: true as const, index: rows.length };
}

const deleteRowSchema = z.object({
  tripId: z.string().uuid(),
  index: z.number().int().min(0).max(19),
});

export async function deleteScheduleRow(input: {
  tripId: string;
  index: number;
}) {
  const parsed = deleteRowSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const g = await gate(parsed.data.tripId);
  if (!g.ok) return { error: g.error };

  const { supabase, data } = await readTrip(parsed.data.tripId);
  if (!data) return { error: "Trip not found." };

  const rows = data.meta?.schedule ?? [];
  if (parsed.data.index >= rows.length) return { error: "Row not found." };

  const nextRows = rows.filter((_, i) => i !== parsed.data.index);
  const nextMeta: TripMeta = {
    ...withBriefBump(data.meta),
    schedule: nextRows,
  };

  const { error } = await supabase
    .from("trips")
    .update({ meta: nextMeta })
    .eq("id", parsed.data.tripId);
  if (error) return { error: "Could not save." };

  revalidateOverview(data.slug);
  return { ok: true as const };
}
