"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  createNotifications,
  tripMemberIdsExcept,
} from "@/lib/notifications";
import { computeEqualShares, type ComputedShare } from "@/lib/ledger/shares";

const participantInputSchema = z.object({
  user_id: z.string().uuid(),
  share_amount: z.number().positive(),
  share_basis: z.enum(["equal", "percentage", "exact"]),
  share_input: z.number().nullable().optional(),
});

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

  // Resolve final share rows
  let shares: Array<ComputedShare & { display_name: string }>;
  if (data.participants && data.participants.length > 0) {
    // Explicit participants. Validate all user_ids are trip members.
    const memberIds = new Set(members.map((m) => m.user_id));
    for (const p of data.participants) {
      if (!memberIds.has(p.user_id)) {
        return { error: "Participant is not a current trip member" };
      }
    }
    shares = data.participants.map((p) => ({
      user_id: p.user_id,
      share_amount: p.share_amount,
      share_basis: p.share_basis,
      share_input: p.share_input ?? null,
      display_name: nameById.get(p.user_id) ?? "Crew",
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

export async function deleteExpense(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data, error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", parsed.data)
    .eq("paid_by", user.id)
    .select("trip_id")
    .maybeSingle<{ trip_id: string }>();
  if (error) return { error: error.message };
  if (!data) return { error: "Only the payer can delete this" };
  await revalidateTrip(data.trip_id);
  return { ok: true };
}
