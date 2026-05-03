"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const voidSchema = z.object({
  obligationId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export async function voidObligation(input: z.infer<typeof voidSchema>) {
  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: ob } = await supabase
    .from("payment_obligations")
    .select("id, trip_id, status, trips:trip_id(slug)")
    .eq("id", parsed.data.obligationId)
    .maybeSingle<{
      id: string;
      trip_id: string;
      status: string;
      trips: { slug: string } | { slug: string }[];
  }>();
  if (!ob) return { error: "Obligation not found" };
  if (ob.status !== "open" && ob.status !== "superseded") {
    return { error: "Obligation cannot be voided" };
  }

  const { data: m } = await supabase
    .from("trip_members")
    .select("role")
    .eq("trip_id", ob.trip_id)
    .eq("user_id", user.id)
    .maybeSingle<{ role: string }>();
  if (m?.role !== "admin") return { error: "Only an admin can void" };

  const nowIso = new Date().toISOString();
  const service = createServiceClient();
  const { error: updErr } = await service
    .from("payment_obligations")
    .update({
      status: "voided",
      voided_by: user.id,
      voided_at: nowIso,
      void_reason: parsed.data.reason ?? null,
    })
    .eq("id", ob.id)
    .in("status", ["open", "superseded"]);
  if (updErr) return { error: updErr.message };

  const trip = Array.isArray(ob.trips) ? ob.trips[0] : ob.trips;
  if (trip?.slug) {
    revalidatePath(`/trips/${trip.slug}/ledger`);
  }
  return { ok: true };
}
