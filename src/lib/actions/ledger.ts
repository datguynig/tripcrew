"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const expenseSchema = z.object({
  tripId: z.string().uuid(),
  description: z.string().min(1).max(200),
  amount: z.number().positive().max(1_000_000),
});

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

export async function addExpense(input: {
  tripId: string;
  description: string;
  amount: number;
}) {
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter a description and amount" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.from("expenses").insert({
    trip_id: parsed.data.tripId,
    description: parsed.data.description,
    amount: parsed.data.amount,
    paid_by: user.id,
  });
  if (error) return { error: error.message };

  await revalidateTrip(parsed.data.tripId);
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
