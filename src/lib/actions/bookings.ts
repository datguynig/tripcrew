"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function revalidateTrip(tripId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trips")
    .select("slug")
    .eq("id", tripId)
    .maybeSingle<{ slug: string }>();
  if (data?.slug) {
    revalidatePath(`/trips/${data.slug}/bookings`);
    revalidatePath(`/trips/${data.slug}`);
  }
}

export async function addBooking(tripId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const parsed = z.string().min(1).max(200).safeParse(title);
  if (!parsed.success) return { error: "Enter a title" };

  const tripIdParsed = z.string().uuid().safeParse(tripId);
  if (!tripIdParsed.success) return { error: "Invalid trip" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: last } = await supabase
    .from("bookings")
    .select("position")
    .eq("trip_id", tripIdParsed.data)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (last?.position ?? 0) + 1;

  const { error } = await supabase.from("bookings").insert({
    trip_id: tripIdParsed.data,
    title: parsed.data,
    position,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  await revalidateTrip(tripIdParsed.data);
  return { ok: true };
}

export async function toggleBookingDone(id: string, done: boolean) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid id" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ done })
    .eq("id", parsed.data)
    .select("trip_id")
    .maybeSingle<{ trip_id: string }>();
  if (error) return { error: error.message };
  if (!data) return { error: "Not permitted" };
  await revalidateTrip(data.trip_id);
  return { ok: true };
}

export async function setBookingAssignee(
  id: string,
  assigneeId: string | null,
) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid id" };
  const assigneeParsed = z.string().uuid().nullable().safeParse(assigneeId);
  if (!assigneeParsed.success) return { error: "Invalid assignee" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ assignee_id: assigneeParsed.data })
    .eq("id", parsed.data)
    .select("trip_id")
    .maybeSingle<{ trip_id: string }>();
  if (error) return { error: error.message };
  if (!data) return { error: "Not permitted" };
  await revalidateTrip(data.trip_id);
  return { ok: true };
}

export async function deleteBooking(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid id" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", parsed.data)
    .select("trip_id")
    .maybeSingle<{ trip_id: string }>();
  if (error) return { error: error.message };
  if (!data) return { error: "Not permitted" };
  await revalidateTrip(data.trip_id);
  return { ok: true };
}
