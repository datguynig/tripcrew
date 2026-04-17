"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TRIP_SLUG } from "@/lib/types";

const expenseSchema = z.object({
  description: z.string().min(1).max(200),
  amount: z.number().positive().max(1_000_000),
});

export async function addExpense(input: {
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

  const { data: trip } = await supabase
    .from("trips")
    .select("id")
    .eq("slug", TRIP_SLUG)
    .single();
  if (!trip) return { error: "Trip missing" };

  const { error } = await supabase.from("expenses").insert({
    trip_id: trip.id,
    description: parsed.data.description,
    amount: parsed.data.amount,
    paid_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/ledger");
  revalidatePath("/");
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

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", parsed.data)
    .eq("paid_by", user.id);
  if (error) return { error: error.message };

  revalidatePath("/ledger");
  revalidatePath("/");
  return { ok: true };
}
