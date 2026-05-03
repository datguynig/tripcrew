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
import { buildObligationRows } from "@/lib/ledger/obligations";
import type { Schedule, ShareBasis } from "@/lib/types";

const scheduleSchema: z.ZodType<Schedule> = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("none") }),
    z.object({
      type: z.literal("single"),
      due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    z.object({
      type: z.literal("installments"),
      installments: z
        .array(
          z.object({
            due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            fraction: z.number().min(0).max(1),
          }),
        )
        .min(2)
        .max(12),
    }),
  ])
  .superRefine((value, ctx) => {
    if (value.type !== "installments") return;
    const sum = value.installments.reduce((s, i) => s + i.fraction, 0);
    if (Math.abs(sum - 1) > 0.0001) {
      ctx.addIssue({
        code: "custom",
        path: ["installments"],
        message: "Installment fractions must sum to 1",
      });
    }
  });

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

function schedulesEqual(a: Schedule | null | undefined, b: Schedule | null | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function sharesEqual(
  next: Array<ComputedShare & { display_name: string }>,
  current: Array<{ user_id: string; share_amount: string | number }>,
): boolean {
  if (next.length !== current.length) return false;
  const currentByUser = new Map(current.map((p) => [p.user_id, Number(p.share_amount)]));
  return next.every((s) => {
    const prev = currentByUser.get(s.user_id);
    return prev != null && Math.abs(prev - s.share_amount) < 0.01;
  });
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
  // Phase 2 — payback schedule. Omit / "none" = no obligations generated.
  schedule: scheduleSchema.optional(),
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
  const service = createServiceClient();
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

  // Phase 2 — persist the schedule on the expense and generate one
  // obligation row per (non-payer × installment-period). Omit / "none"
  // schedules generate no obligations; the existing per-expense splits
  // continue to drive the live settlement panel.
  if (data.schedule) {
    const { error: scheduleErr } = await supabase
      .from("expenses")
      .update({ schedule: data.schedule })
      .eq("id", expense.id);
    if (scheduleErr) {
      console.error("[ledger.addExpense] schedule update failed", scheduleErr);
      return { error: "Saved expense, but payback schedule couldn't be recorded." };
    }
  }
  if (data.schedule && data.schedule.type !== "none") {
    const rows = buildObligationRows({
      expense_id: expense.id,
      trip_id: data.tripId,
      payer_id: user.id,
      payer_name: actor?.name ?? "Crew",
      expense_version: 1,
      currency: trip?.currency ?? "GBP",
      participants: shares.map((s) => ({
        user_id: s.user_id,
        share_amount: s.share_amount,
        display_name_snapshot: s.display_name,
      })),
      schedule: data.schedule,
    });
    if (rows.length > 0) {
      const { error: obErr } = await service
        .from("payment_obligations")
        .insert(rows.map((r) => ({ ...r, created_by: user.id })));
      if (obErr) {
        console.error("[ledger.addExpense] obligation insert failed", obErr);
        return {
          error:
            "Saved expense, but payback obligations couldn't be recorded. Edit the expense to retry.",
        };
      }
    }
  }

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
  const service = createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Authorise: original payer or trip admin
  const { data: existing } = await supabase
    .from("expenses")
    .select("id, paid_by, trip_id, amount, version, schedule")
    .eq("id", data.expenseId)
    .maybeSingle<{
      id: string;
      paid_by: string;
      trip_id: string;
      amount: string;
      version: number;
      schedule: Schedule | null;
    }>();
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

  // Read current trip members for share computation + display-name snapshots.
  // Done before any mutation so we can validate the full replacement set first.
  const { data: members } = await supabase
    .from("trip_members")
    .select("user_id, profiles!trip_members_user_id_fkey(name)")
    .eq("trip_id", existing.trip_id);
  if (!members || members.length === 0) {
    return { error: "Trip has no members" };
  }
  const nameById = new Map<string, string>();
  for (const m of members) {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    if (profile?.name) nameById.set(m.user_id, profile.name);
  }

  // Compute and validate the replacement participant set BEFORE any mutation.
  // When participants is omitted, default to even split across current members
  // (matches addExpense). This stops "edit description on a default expense
  // wipes shares" because the dialog only sends participants when the user
  // opts into a custom split.
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

  const { data: currentParticipants } = await supabase
    .from("expense_participants")
    .select("user_id, share_amount")
    .eq("expense_id", data.expenseId)
    .is("deleted_at", null);
  const nextSchedule = data.schedule ?? existing.schedule ?? null;
  const scheduleChanged = data.schedule !== undefined && !schedulesEqual(data.schedule, existing.schedule);
  const amountChanged = Math.abs(Number(existing.amount) - data.amount) >= 0.01;
  const shareChanged = !sharesEqual(shares, currentParticipants ?? []);
  const shouldRegenerateObligations =
    !!nextSchedule && (scheduleChanged || amountChanged || shareChanged);

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
  // versioned regeneration of obligations on top of this edit. An RPC
  // transaction is the right shape long term; pre-validation above keeps
  // the partial-failure window tight (only the final insert can fail).
  const { error: partDeleteErr } = await supabase
    .from("expense_participants")
    .update({ deleted_at: new Date().toISOString() })
    .eq("expense_id", data.expenseId)
    .is("deleted_at", null);
  if (partDeleteErr) {
    console.error("[ledger.editExpense] participants soft-delete failed", partDeleteErr);
    return {
      error:
        "Saved expense changes, but the old split couldn't be cleared. Try again before editing the split.",
    };
  }

  const { error: insErr } = await supabase.from("expense_participants").insert(
    shares.map((s) => ({
      trip_id: existing.trip_id,
      expense_id: data.expenseId,
      user_id: s.user_id,
      share_amount: s.share_amount,
      share_basis: s.share_basis,
      share_input: s.share_input,
      display_name_snapshot: s.display_name,
    })),
  );
  if (insErr) {
    console.error("[ledger.editExpense] participants insert failed", insErr);
    return {
      error:
        "Saved expense changes, but the split couldn't be re-recorded. Edit the expense again to retry.",
    };
  }

  // Phase 2 — persist schedule, supersede current obligations, regenerate
  // from the new (amount, participants, schedule), then auto-pair the
  // simplest exact-match case (debtor/creditor/due_date/amount all equal).
  // Anything that doesn't auto-pair surfaces in ReissuedPanel for admin
  // attention.
  if (data.schedule) {
    const { error: scheduleErr } = await supabase
      .from("expenses")
      .update({ schedule: data.schedule })
      .eq("id", data.expenseId);
    if (scheduleErr) {
      console.error("[ledger.editExpense] schedule update failed", scheduleErr);
      return { error: "Saved expense changes, but payback schedule couldn't be updated." };
    }
  }

  let oldObligations: Array<{
    id: string;
    debtor_id: string;
    creditor_id: string;
    due_date: string | null;
    amount: string;
  }> = [];

  if (shouldRegenerateObligations) {
    const { data: oldRows, error: oldObligationsErr } = await supabase
      .from("payment_obligations")
      .select("id, debtor_id, creditor_id, due_date, amount")
      .eq("expense_id", data.expenseId)
      .eq("status", "open");
    if (oldObligationsErr) return { error: oldObligationsErr.message };
    oldObligations = oldRows ?? [];

    const oldIds = oldObligations.map((o) => o.id);
    if (oldIds.length > 0) {
      const { error: supersedeErr } = await service
        .from("payment_obligations")
        .update({ status: "superseded" })
        .in("id", oldIds);
      if (supersedeErr) {
        console.error("[ledger.editExpense] obligation supersede failed", supersedeErr);
        return { error: "Saved expense changes, but existing payback obligations couldn't be reissued." };
      }
    }
  }

  if (shouldRegenerateObligations && nextSchedule.type !== "none") {
    const { data: payerRow } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", existing.paid_by)
      .maybeSingle<{ name: string }>();
    const { data: tripRow } = await supabase
      .from("trips")
      .select("currency")
      .eq("id", existing.trip_id)
      .maybeSingle<{ currency: string }>();
    const newRows = buildObligationRows({
      expense_id: data.expenseId,
      trip_id: existing.trip_id,
      payer_id: existing.paid_by,
      payer_name: payerRow?.name ?? "Crew",
      expense_version: existing.version + 1,
      currency: tripRow?.currency ?? "GBP",
      participants: shares.map((s) => ({
        user_id: s.user_id,
        share_amount: s.share_amount,
        display_name_snapshot: s.display_name,
      })),
      schedule: nextSchedule,
    });
    if (newRows.length > 0) {
      const { data: insertedRows, error: newRowsErr } = await service
        .from("payment_obligations")
        .insert(
          newRows.map((r) => ({ ...r, created_by: user.id })),
        )
        .select("id, debtor_id, creditor_id, due_date, amount");
      if (newRowsErr) {
        console.error("[ledger.editExpense] obligation insert failed", newRowsErr);
        if (oldObligations.length > 0) {
          await service
            .from("payment_obligations")
            .update({ status: "open" })
            .in("id", oldObligations.map((o) => o.id))
            .eq("status", "superseded");
        }
        return { error: "Saved expense changes, but replacement payback obligations couldn't be recorded." };
      }

      const newRowsInserted = insertedRows ?? [];
      for (const oldOb of oldObligations ?? []) {
        const candidate = newRowsInserted.find(
          (n) =>
            n.debtor_id === oldOb.debtor_id &&
            n.creditor_id === oldOb.creditor_id &&
            n.due_date === oldOb.due_date &&
            Number(n.amount) === Number(oldOb.amount),
        );
        if (candidate) {
          const { error: moveErr } = await service
            .from("payments")
            .update({ obligation_id: candidate.id })
            .eq("obligation_id", oldOb.id)
            .in("status", ["pending", "verified"]);
          if (moveErr) {
            console.error("[ledger.editExpense] payment auto-pair failed", moveErr);
            return { error: "Saved expense changes, but existing payments couldn't be re-linked." };
          }
          const { error: pairErr } = await service
            .from("payment_obligations")
            .update({ superseded_by: candidate.id })
            .eq("id", oldOb.id);
          if (pairErr) {
            console.error("[ledger.editExpense] superseded_by update failed", pairErr);
            return { error: "Saved expense changes, but reissued obligations couldn't be linked." };
          }
        }
      }
    }
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

  const { error: participantDeleteErr } = await supabase
    .from("expense_participants")
    .update({ deleted_at: deletedAt })
    .eq("expense_id", parsed.data)
    .is("deleted_at", null);
  if (participantDeleteErr) {
    console.error("[ledger.deleteExpense] participants soft-delete failed", participantDeleteErr);
    await supabase
      .from("expenses")
      .update({ deleted_at: null })
      .eq("id", parsed.data)
      .eq("deleted_at", deletedAt);
    return {
      error:
        "The expense couldn't be fully deleted because its split rows did not update. Try again.",
    };
  }

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

  const { error: expenseRestoreErr } = await supabase
    .from("expenses")
    .update({ deleted_at: null })
    .eq("id", parsed.data);
  if (expenseRestoreErr) return { error: expenseRestoreErr.message };

  if (snap?.deleted_at) {
    const { error: participantRestoreErr } = await supabase
      .from("expense_participants")
      .update({ deleted_at: null })
      .eq("expense_id", parsed.data)
      .eq("deleted_at", snap.deleted_at);
    if (participantRestoreErr) {
      console.error("[ledger.restoreExpense] participants restore failed", participantRestoreErr);
      await supabase
        .from("expenses")
        .update({ deleted_at: snap.deleted_at })
        .eq("id", parsed.data)
        .is("deleted_at", null);
      return {
        error:
          "The expense couldn't be fully restored because its split rows did not update. Try again.",
      };
    }
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
