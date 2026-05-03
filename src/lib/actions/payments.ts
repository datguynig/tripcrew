"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { createNotifications } from "@/lib/notifications";

const recordPaymentSchema = z.object({
  obligationId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  note: z.string().max(500).optional(),
});

async function revalidateTripFromObligation(obligationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_obligations")
    .select("trip_id, trips:trip_id(slug)")
    .eq("id", obligationId)
    .maybeSingle<{ trip_id: string; trips: { slug: string } | { slug: string }[] }>();
  if (!data) return;
  const trip = Array.isArray(data.trips) ? data.trips[0] : data.trips;
  if (trip?.slug) {
    revalidatePath(`/trips/${trip.slug}/ledger`);
    revalidatePath(`/trips/${trip.slug}`);
  }
}

export async function recordPayment(input: z.infer<typeof recordPaymentSchema>) {
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Authorise: debtor or creditor only
  const { data: ob } = await supabase
    .from("payment_obligations")
    .select("id, trip_id, debtor_id, creditor_id, amount, currency, status")
    .eq("id", parsed.data.obligationId)
    .maybeSingle<{
      id: string;
      trip_id: string;
      debtor_id: string;
      creditor_id: string;
      amount: string;
      currency: string;
      status: string;
    }>();
  if (!ob) return { error: "Obligation not found" };
  if (ob.status !== "open") return { error: "Obligation is not open" };
  if (ob.debtor_id !== user.id && ob.creditor_id !== user.id) {
    return { error: "Only the debtor or creditor can record a payment" };
  }

  const service = createServiceClient();
  const { data: payment, error: insErr } = await service
    .from("payments")
    .insert({
      obligation_id: ob.id,
      amount: parsed.data.amount,
      recorded_by: user.id,
      note: parsed.data.note ?? null,
    })
    .select("id")
    .single();
  if (insErr || !payment) return { error: insErr?.message ?? "Insert failed" };

  await revalidateTripFromObligation(ob.id);

  // Notify the creditor (or debtor if creditor recorded)
  const recipient = user.id === ob.debtor_id ? ob.creditor_id : ob.debtor_id;
  const { data: actor } = await service
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle<{ name: string }>();
  await createNotifications({
    tripId: ob.trip_id,
    actorId: user.id,
    kind: "payment_recorded",
    entityId: payment.id,
    payload: {
      debtor_name: actor?.name,
      obligation_id: ob.id,
      payment_id: payment.id,
      expense_amount: parsed.data.amount.toFixed(2),
      expense_currency: ob.currency,
    },
    recipients: [recipient],
  });

  return { ok: true, payment_id: payment.id };
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

async function fetchObligationContext(obligationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payment_obligations")
    .select("id, trip_id, debtor_id, creditor_id, amount, currency, status")
    .eq("id", obligationId)
    .maybeSingle<{
      id: string;
      trip_id: string;
      debtor_id: string;
      creditor_id: string;
      amount: string;
      currency: string;
      status: string;
    }>();
  return data;
}

async function isAdmin(userId: string, tripId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle<{ role: string }>();
  return data?.role === "admin";
}

export async function verifyPayment(paymentId: string) {
  const parsed = z.string().uuid().safeParse(paymentId);
  if (!parsed.success) return { error: "Invalid id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: payment } = await supabase
    .from("payments")
    .select("id, obligation_id, status, amount, recorded_by")
    .eq("id", parsed.data)
    .maybeSingle<{ id: string; obligation_id: string; status: string; amount: string; recorded_by: string }>();
  if (!payment) return { error: "Payment not found" };
  if (payment.status !== "pending") {
    return { error: `Cannot verify a ${payment.status} payment` };
  }

  const ob = await fetchObligationContext(payment.obligation_id);
  if (!ob) return { error: "Obligation not found" };
  if (ob.status !== "open") return { error: "Obligation is not open" };

  if (!(await isAdmin(user.id, ob.trip_id))) {
    return { error: "Only an admin can verify" };
  }

  const nowIso = new Date().toISOString();
  const service = createServiceClient();
  const { error: updErr } = await service
    .from("payments")
    .update({ status: "verified", verified_by: user.id, verified_at: nowIso })
    .eq("id", payment.id)
    .eq("status", "pending");
  if (updErr) return { error: updErr.message };

  await revalidateTripFromObligation(payment.obligation_id);

  await createNotifications({
    tripId: ob.trip_id,
    actorId: user.id,
    kind: "payment_verified",
    entityId: payment.id,
    payload: {
      payment_id: payment.id,
      expense_amount: payment.amount,
      expense_currency: ob.currency,
    },
    recipients: [payment.recorded_by],
  });

  return { ok: true };
}

const rejectSchema = z.object({
  paymentId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

export async function rejectPayment(input: z.infer<typeof rejectSchema>) {
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: payment } = await supabase
    .from("payments")
    .select("id, obligation_id, status, amount, recorded_by")
    .eq("id", parsed.data.paymentId)
    .maybeSingle<{ id: string; obligation_id: string; status: string; amount: string; recorded_by: string }>();
  if (!payment) return { error: "Payment not found" };
  if (payment.status !== "pending") {
    return { error: `Cannot reject a ${payment.status} payment` };
  }

  const ob = await fetchObligationContext(payment.obligation_id);
  if (!ob) return { error: "Obligation not found" };

  // Creditor or admin
  const allowed = ob.creditor_id === user.id || (await isAdmin(user.id, ob.trip_id));
  if (!allowed) return { error: "Only the creditor or an admin can reject" };

  const nowIso = new Date().toISOString();
  const service = createServiceClient();
  const { error: updErr } = await service
    .from("payments")
    .update({
      status: "rejected",
      rejected_by: user.id,
      rejected_at: nowIso,
      rejection_note: parsed.data.note ?? null,
    })
    .eq("id", payment.id)
    .eq("status", "pending");
  if (updErr) return { error: updErr.message };

  await revalidateTripFromObligation(payment.obligation_id);

  await createNotifications({
    tripId: ob.trip_id,
    actorId: user.id,
    kind: "payment_rejected",
    entityId: payment.id,
    payload: {
      payment_id: payment.id,
      expense_amount: payment.amount,
      expense_currency: ob.currency,
      rejection_note: parsed.data.note,
    },
    recipients: [payment.recorded_by],
  });

  return { ok: true };
}

const voidSchema = z.object({
  paymentId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export async function voidPayment(input: z.infer<typeof voidSchema>) {
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: payment } = await supabase
    .from("payments")
    .select("id, obligation_id, status, recorded_by, recorded_at")
    .eq("id", parsed.data.paymentId)
    .maybeSingle<{
      id: string;
      obligation_id: string;
      status: string;
      recorded_by: string;
      recorded_at: string;
    }>();
  if (!payment) return { error: "Payment not found" };
  if (payment.status !== "pending" && payment.status !== "verified") {
    return { error: `Cannot void a ${payment.status} payment` };
  }

  const ob = await fetchObligationContext(payment.obligation_id);
  if (!ob) return { error: "Obligation not found" };

  // Authority: recorder within 5 min, otherwise admin only.
  // Verified payments can only be voided by admin (regardless of window).
  const isRecorder = payment.recorded_by === user.id;
  const withinWindow =
    Date.now() - Date.parse(payment.recorded_at) <= FIVE_MINUTES_MS;
  const userIsAdmin = await isAdmin(user.id, ob.trip_id);

  const allowed =
    payment.status === "pending"
      ? (isRecorder && withinWindow) || userIsAdmin
      : userIsAdmin;
  if (!allowed) {
    return { error: "Only the recorder (within 5 min) or an admin can void" };
  }

  const nowIso = new Date().toISOString();
  const service = createServiceClient();
  const { error: updErr } = await service
    .from("payments")
    .update({
      status: "voided",
      voided_by: user.id,
      voided_at: nowIso,
      void_reason: parsed.data.reason ?? null,
    })
    .eq("id", payment.id)
    .in("status", ["pending", "verified"]);
  if (updErr) return { error: updErr.message };

  await revalidateTripFromObligation(payment.obligation_id);
  return { ok: true };
}
