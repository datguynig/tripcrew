"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type SetBookingUrlResult =
  | { success: true }
  | { success: false; error: string };

const InputSchema = z.object({
  bookingId: z.string().uuid("Invalid booking ID."),
  url: z.preprocess(
    (v) =>
      typeof v === "string" && v.trim() !== "" ? v.trim() : null,
    z
      .string()
      .max(2000, "URL too long (max 2000 chars).")
      .url("URL not parseable.")
      .refine(
        (u) => u.startsWith("http://") || u.startsWith("https://"),
        { message: "URL must be http or https." },
      )
      .nullable(),
  ),
});

export async function setBookingCustomUrl(
  bookingId: string,
  url: string | null,
): Promise<SetBookingUrlResult> {
  const parsed = InputSchema.safeParse({ bookingId, url });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { bookingId: validatedId, url: validatedUrl } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: row } = await supabase
    .from("bookings")
    .select("trip_id, trip_members!inner(role, user_id)")
    .eq("id", validatedId)
    .eq("trip_members.user_id", user.id)
    .eq("trip_members.role", "admin")
    .maybeSingle<{ trip_id: string }>();

  if (!row) return { success: false, error: "Not authorised." };

  const { error } = await supabase
    .from("bookings")
    .update({ custom_url: validatedUrl })
    .eq("id", validatedId)
    .eq("trip_id", row.trip_id);
  if (error) {
    return { success: false, error: "Could not save URL." };
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("slug")
    .eq("id", row.trip_id)
    .maybeSingle<{ slug: string }>();
  if (trip?.slug) revalidatePath(`/trips/${trip.slug}/bookings`);

  return { success: true };
}
