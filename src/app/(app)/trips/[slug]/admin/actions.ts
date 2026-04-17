"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export type ActionState = { ok?: true; error?: string } | undefined;

const identitySchema = z.object({
  tripId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  destination: z
    .string()
    .trim()
    .max(80)
    .transform((v) => v || null)
    .nullable(),
});

export async function updateTripIdentity(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = identitySchema.safeParse({
    tripId: formData.get("tripId"),
    name: formData.get("name"),
    destination: formData.get("destination") ?? "",
  });
  if (!parsed.success) {
    return { error: "Name is required (max 80). Destination max 80." };
  }

  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const supabase = await createClient();
  const { data: trip, error } = await supabase
    .from("trips")
    .update({
      name: parsed.data.name,
      destination: parsed.data.destination,
    })
    .eq("id", parsed.data.tripId)
    .select("slug")
    .maybeSingle<{ slug: string }>();

  if (error) {
    console.error("update trip identity", error);
    return { error: "Could not save. Admin only." };
  }
  if (!trip) return { error: "Trip not found or not permitted." };

  revalidatePath(`/trips/${trip.slug}`);
  revalidatePath(`/trips/${trip.slug}/admin`);
  return { ok: true };
}
