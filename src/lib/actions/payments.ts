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

  const { data: payment, error: insErr } = await supabase
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
  const service = createServiceClient();
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
