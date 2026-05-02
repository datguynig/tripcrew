"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  createNotifications,
  tripMemberIdsExcept,
} from "@/lib/notifications";
import {
  computeEqualShares,
  computePercentageShares,
  computeExactShares,
  type ComputedShare,
} from "@/lib/ledger/shares";
import type { ShareBasis } from "@/lib/types";

// share_amount is intentionally NOT in the input schema. The server
// always recomputes shares from (share_basis, share_input) so a
// crafted request can't make participant shares total ≠ amount.
const participantInputSchema = z.object({
  user_id: z.string().uuid(),
  share_basis: z.enum(["equal", "percentage", "exact"]),
  share_input: z.number().nullable().optional(),
});

type ParticipantInput = z.infer<typeof participantInputSchema>;

function recomputeShares(
  total: number,
  participants: ParticipantInput[],
): { ok: true; shares: ComputedShare[] } | { ok: false; error: string } {
  if (participants.length === 0) {
    return { ok: false, error: "Need at least one participant" };
  }
  const basis: ShareBasis = participants[0].share_basis;
  if (!participants.every((p) => p.share_basis === basis)) {
    return { ok: false, error: "Mixed share basis not supported" };
  }
  if (basis === "equal") {
    return {
      ok: true,
      shares: computeEqualShares(total, participants.map((p) => p.user_id)),
    };
  }
  if (basis === "percentage") {
    const inputs = participants.map((p) => ({
      user_id: p.user_id,
      input: p.share_input ?? 0,
    }));
    const sumPct = inputs.reduce((s, i) => s + i.input, 0);
    if (Math.abs(sumPct - 100) > 0.01) {
      return { ok: false, error: "Percentages must sum to 100" };
    }
    return { ok: true, shares: computePercentageShares(total, inputs) };
  }
  // exact
  const inputs = participants.map((p) => ({
    user_id: p.user_id,
    input: p.share_input ?? 0,
  }));
  const sumExact = inputs.reduce((s, i) => s + i.input, 0);
  if (Math.abs(sumExact - total) > 0.01) {
    return { ok: false, error: "Exact amounts must sum to the total" };
  }
  return { ok: true, shares: computeExactShares(inputs) };
}

const addExpenseSchema = z.object({
  tripId: z.string().uuid(),
  description: z.string().min(1).max(200),
  amount: z.number().positive().max(1_000_000),
  // FX (optional)
  original_currency: z.string().length(3).nullable().optional(),
  original_amount: z.number().positive().nullable().optional(),
  fx_rate: z.number().positive().nullable().optional(),
  fx_rate_source: z.enum(["frankfurter", "manual"]).nullable().optional(),
  fx_rate_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  fx_suggested_amount: z.number().positive().nullable().optional(),
  fx_user_overridden: z.boolean().optional(),
  // Participants. When omitted, defaults to even split across all current trip members.
  participants: z.array(participantInputSchema).min(1).optional(),
});

export type AddExpenseInput = z.infer<typeof addExpenseSchema>;

async function revalidateTrip(tripId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trips")
    .select("slug")
    .eq("id", tripId)
    .maybeSingle<{ slug: string }>();
  if (data?.slug) {
    revalidatePath(`/trips/${data.slug}/ledger`);
    revalidatePath(`/trips/${data.slug}`);
  }
}

export async function addExpense(input: AddExpenseInput) {
  const parsed = addExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Fetch member list + names for either default-share computation or
  // display_name_snapshot capture for explicit participants.
  const { data: members } = await supabase
    .from("trip_members")
    .select("user_id, profiles!trip_members_user_id_fkey(name)")
    .eq("trip_id", data.tripId);
  if (!members || members.length === 0) {
    return { error: "Trip has no members" };
  }
  const nameById = new Map<string, string>();
  for (const m of members) {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    if (profile?.name) nameById.set(m.user_id, profile.name);
  }

  // Resolve final share rows. The server always recomputes share_amount
  // from (share_basis, share_input) — see recomputeShares.
  let shares: Array<ComputedShare & { display_name: string }>;
  if (data.participants && data.participants.length > 0) {
    const memberIds = new Set(members.map((m) => m.user_id));
    for (const p of data.participants) {
      if (!memberIds.has(p.user_id)) {
        return { error: "Participant is not a current trip member" };
      }
    }
    const result = recomputeShares(data.amount, data.participants);
    if (!result.ok) return { error: result.error };
    shares = result.shares.map((c) => ({
      ...c,
      display_name: nameById.get(c.user_id) ?? "Crew",
    }));
  } else {
    const computed = computeEqualShares(
      data.amount,
      members.map((m) => m.user_id),
    );
    shares = computed.map((c) => ({
      ...c,
      display_name: nameById.get(c.user_id) ?? "Crew",
    }));
  }

  // Insert expense + participants in two writes; we accept a small
  // window where participants may be missing if the second insert
  // fails. The page then surfaces the row as "no participants" and
  // admin can re-edit. A Postgres function for true atomicity is a
  // future polish.
  const { data: expense, error: insErr } = await supabase
    .from("expenses")
    .insert({
      trip_id: data.tripId,
      description: data.description,
      amount: data.amount,
      paid_by: user.id,
      original_currency: data.original_currency ?? null,
      original_amount: data.original_amount ?? null,
      fx_rate: data.fx_rate ?? null,
      fx_rate_source: data.fx_rate_source ?? null,
      fx_rate_date: data.fx_rate_date ?? null,
      fx_suggested_amount: data.fx_suggested_amount ?? null,
      fx_user_overridden: data.fx_user_overridden ?? false,
    })
    .select("id")
    .single();
  if (insErr || !expense) return { error: insErr?.message ?? "Insert failed" };

  const { error: partErr } = await supabase.from("expense_participants").insert(
    shares.map((s) => ({
      trip_id: data.tripId,
      expense_id: expense.id,
      user_id: s.user_id,
      share_amount: s.share_amount,
      share_basis: s.share_basis,
      share_input: s.share_input,
      display_name_snapshot: s.display_name,
    })),
  );
  if (partErr) {
    console.error("[ledger.addExpense] participants insert failed", partErr);
    return { error: "Saved expense, but split couldn't be recorded. Edit the expense to retry." };
  }

  await revalidateTrip(data.tripId);

  const service = createServiceClient();
  const [{ data: actor }, { data: trip }, recipients] = await Promise.all([
    service
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .maybeSingle<{ name: string }>(),
    service
      .from("trips")
      .select("name, slug, currency")
      .eq("id", data.tripId)
      .maybeSingle<{ name: string; slug: string; currency: string | null }>(),
    tripMemberIdsExcept(data.tripId, user.id),
  ]);
  await createNotifications({
    tripId: data.tripId,
    actorId: user.id,
    kind: "expense_added",
    payload: {
      actor_name: actor?.name,
      trip_name: trip?.name,
      trip_slug: trip?.slug,
      expense_description: data.description,
      expense_amount: data.amount.toFixed(2),
      expense_currency: trip?.currency ?? "",
    },
    recipients,
  });
  return { ok: true };
}

const editExpenseSchema = addExpenseSchema.extend({
  expenseId: z.string().uuid(),
});

export type EditExpenseInput = z.infer<typeof editExpenseSchema>;

export async function editExpense(input: EditExpenseInput) {
  const parsed = editExpenseSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Authorise: original payer or trip admin
  const { data: existing } = await supabase
    .from("expenses")
    .select("id, paid_by, trip_id, version")
    .eq("id", data.expenseId)
    .maybeSingle<{ id: string; paid_by: string; trip_id: string; version: number }>();
  if (!existing) return { error: "Expense not found" };
  if (existing.paid_by !== user.id) {
    const { data: membership } = await supabase
      .from("trip_members")
      .select("role")
      .eq("trip_id", existing.trip_id)
      .eq("user_id", user.id)
      .maybeSingle<{ role: string }>();
    if (membership?.role !== "admin") return { error: "Not authorised" };
  }

  // Bump version, write the expense fields
  const { error: updErr } = await supabase
    .from("expenses")
    .update({
      description: data.description,
      amount: data.amount,
      original_currency: data.original_currency ?? null,
      original_amount: data.original_amount ?? null,
      fx_rate: data.fx_rate ?? null,
      fx_rate_source: data.fx_rate_source ?? null,
      fx_rate_date: data.fx_rate_date ?? null,
      fx_suggested_amount: data.fx_suggested_amount ?? null,
      fx_user_overridden: data.fx_user_overridden ?? false,
      version: existing.version + 1,
    })
    .eq("id", data.expenseId);
  if (updErr) return { error: updErr.message };

  // Soft-delete current participants and re-insert. Phase 2 will do
  // versioned regeneration of obligations on top of this edit.
  await supabase
    .from("expense_participants")
    .update({ deleted_at: new Date().toISOString() })
    .eq("expense_id", data.expenseId)
    .is("deleted_at", null);

  if (data.participants && data.participants.length > 0) {
    const { data: members } = await supabase
      .from("trip_members")
      .select("user_id, profiles!trip_members_user_id_fkey(name)")
      .eq("trip_id", existing.trip_id);
    const memberIds = new Set((members ?? []).map((m) => m.user_id));
    for (const p of data.participants) {
      if (!memberIds.has(p.user_id)) {
        return { error: "Participant is not a current trip member" };
      }
    }
    const nameById = new Map<string, string>();
    for (const m of members ?? []) {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      if (profile?.name) nameById.set(m.user_id, profile.name);
    }
    const result = recomputeShares(data.amount, data.participants);
    if (!result.ok) return { error: result.error };
    const { error: insErr } = await supabase.from("expense_participants").insert(
      result.shares.map((s) => ({
        trip_id: existing.trip_id,
        expense_id: data.expenseId,
        user_id: s.user_id,
        share_amount: s.share_amount,
        share_basis: s.share_basis,
        share_input: s.share_input,
        display_name_snapshot: nameById.get(s.user_id) ?? "Crew",
      })),
    );
    if (insErr) return { error: insErr.message };
  }

  await revalidateTrip(existing.trip_id);
  return { ok: true };
}

export async function deleteExpense(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Authorise: original payer or trip admin
  const { data: existing } = await supabase
    .from("expenses")
    .select("trip_id, paid_by")
    .eq("id", parsed.data)
    .is("deleted_at", null)
    .maybeSingle<{ trip_id: string; paid_by: string }>();
  if (!existing) return { error: "Expense not found" };
  if (existing.paid_by !== user.id) {
    const { data: m } = await supabase
      .from("trip_members")
      .select("role")
      .eq("trip_id", existing.trip_id)
      .eq("user_id", user.id)
      .maybeSingle<{ role: string }>();
    if (m?.role !== "admin") return { error: "Not authorised" };
  }

  // Share one timestamp between the expense and participant rows so
  // restoreExpense can scope the participant restore to exactly the
  // rows soft-deleted at delete time (not pre-edit historical rows).
  const deletedAt = new Date().toISOString();

  const { error } = await supabase
    .from("expenses")
    .update({ deleted_at: deletedAt })
    .eq("id", parsed.data)
    .is("deleted_at", null);
  if (error) return { error: error.message };

  await supabase
    .from("expense_participants")
    .update({ deleted_at: deletedAt })
    .eq("expense_id", parsed.data)
    .is("deleted_at", null);

  await revalidateTrip(existing.trip_id);
  return { ok: true };
}

export async function restoreExpense(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Admin or original payer can restore
  const { data: row } = await supabase
    .from("expenses")
    .select("trip_id, paid_by")
    .eq("id", parsed.data)
    .maybeSingle<{ trip_id: string; paid_by: string }>();
  if (!row) return { error: "Expense not found" };
  if (row.paid_by !== user.id) {
    const { data: m } = await supabase
      .from("trip_members")
      .select("role")
      .eq("trip_id", row.trip_id)
      .eq("user_id", user.id)
      .maybeSingle<{ role: string }>();
    if (m?.role !== "admin") return { error: "Not authorised" };
  }

  // Read the expense's deleted_at BEFORE clearing it; use the timestamp
  // to scope the participant restore so we only un-soft-delete the rows
  // that were soft-deleted as part of the same delete operation. Pre-edit
  // historical participant rows (with an earlier deleted_at) stay deleted.
  const { data: snap } = await supabase
    .from("expenses")
    .select("deleted_at")
    .eq("id", parsed.data)
    .maybeSingle<{ deleted_at: string | null }>();

  await supabase.from("expenses").update({ deleted_at: null }).eq("id", parsed.data);

  if (snap?.deleted_at) {
    await supabase
      .from("expense_participants")
      .update({ deleted_at: null })
      .eq("expense_id", parsed.data)
      .eq("deleted_at", snap.deleted_at);
  }

  await revalidateTrip(row.trip_id);
  return { ok: true };
}

export async function dismissMigrationWarning(tripId: string) {
  const parsed = z.string().uuid().safeParse(tripId);
  if (!parsed.success) return { error: "Invalid id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: m } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", parsed.data)
    .eq("user_id", user.id)
    .maybeSingle<{ role: string }>();
  if (m?.role !== "admin") return { error: "Not authorised" };

  const { data: trip } = await supabase
    .from("trips")
    .select("meta, slug")
    .eq("id", parsed.data)
    .maybeSingle<{ meta: Record<string, unknown> | null; slug: string }>();
  if (!trip) return { error: "Trip not found" };

  const meta = (trip.meta ?? {}) as Record<string, unknown>;
  const warnings = (meta.migration_warnings ?? {}) as Record<string, unknown>;
  const phantom = (warnings.ledger_v2_phantom_shares ?? {}) as Record<string, unknown>;
  const nextMeta = {
    ...meta,
    migration_warnings: {
      ...warnings,
      ledger_v2_phantom_shares: { ...phantom, shown: true },
    },
  };

  await supabase.from("trips").update({ meta: nextMeta }).eq("id", parsed.data);
  if (trip.slug) revalidatePath(`/trips/${trip.slug}/ledger`);
  return { ok: true };
}
