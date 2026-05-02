"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SetBookingUrlResult =
  | { success: true }
  | { success: false; error: string };

const MAX_URL_LENGTH = 2000;

function validateUrl(
  url: string | null,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (url === null) return { ok: true, value: null };
  const trimmed = url.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, error: "URL too long (max 2000 chars)." };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "URL not parseable." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "URL must be http or https." };
  }
  return { ok: true, value: trimmed };
}

export async function setBookingCustomUrl(
  bookingId: string,
  url: string | null,
): Promise<SetBookingUrlResult> {
  const validated = validateUrl(url);
  if (!validated.ok) return { success: false, error: validated.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  // Admin membership check on the booking's trip.
  const { data: row } = await supabase
    .from("bookings")
    .select("trip_id, trip_members!inner(role, user_id)")
    .eq("id", bookingId)
    .eq("trip_members.user_id", user.id)
    .eq("trip_members.role", "admin")
    .maybeSingle<{ trip_id: string }>();

  if (!row) return { success: false, error: "Not authorised." };

  const { error } = await supabase
    .from("bookings")
    .update({ custom_url: validated.value })
    .eq("id", bookingId);
  if (error) {
    return { success: false, error: "Could not save URL." };
  }

  // Revalidate the trip's bookings page so the new URL surfaces.
  const { data: trip } = await supabase
    .from("trips")
    .select("slug")
    .eq("id", row.trip_id)
    .maybeSingle<{ slug: string }>();
  if (trip?.slug) revalidatePath(`/trips/${trip.slug}/bookings`);

  return { success: true };
}
