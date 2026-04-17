"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TRIP_SLUG } from "@/lib/types";

export async function addBooking(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const parsed = z.string().min(1).max(200).safeParse(title);
  if (!parsed.success) return { error: "Enter a title" };

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

  const { data: last } = await supabase
    .from("bookings")
    .select("position")
    .eq("trip_id", trip.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (last?.position ?? 0) + 1;

  const { error } = await supabase.from("bookings").insert({
    trip_id: trip.id,
    title: parsed.data,
    position,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/bookings");
  return { ok: true };
}

export async function toggleBookingDone(id: string, done: boolean) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid id" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ done })
    .eq("id", parsed.data);
  if (error) return { error: error.message };
  revalidatePath("/bookings");
  return { ok: true };
}

export async function setBookingAssignee(
  id: string,
  assigneeId: string | null,
) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid id" };
  const assigneeParsed = z
    .string()
    .uuid()
    .nullable()
    .safeParse(assigneeId);
  if (!assigneeParsed.success) return { error: "Invalid assignee" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ assignee_id: assigneeParsed.data })
    .eq("id", parsed.data);
  if (error) return { error: error.message };
  revalidatePath("/bookings");
  return { ok: true };
}

export async function deleteBooking(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid id" };

  const supabase = await createClient();
  const { error } = await supabase.from("bookings").delete().eq("id", parsed.data);
  if (error) return { error: error.message };
  revalidatePath("/bookings");
  return { ok: true };
}
