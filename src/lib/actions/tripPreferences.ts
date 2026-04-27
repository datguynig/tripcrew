"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getTripMember } from "@/lib/auth";
import { preferencesSchema } from "@/lib/validators/aiPreferences";
import type { AiPreferences, TripMeta } from "@/lib/types";

const inputSchema = z.object({
  tripId: z.string().uuid(),
  preferences: preferencesSchema,
});

export async function updateTripPreferences(input: {
  tripId: string;
  preferences: AiPreferences;
}): Promise<{ ok: true } | { ok?: false; error: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid preferences." };

  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };

  const member = await getTripMember(parsed.data.tripId, user.id);
  if (!member || member.role !== "admin") return { error: "Admin only." };

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("slug, meta")
    .eq("id", parsed.data.tripId)
    .maybeSingle<{ slug: string; meta: TripMeta | null }>();

  if (!trip) return { error: "Trip not found." };

  const nextMeta: TripMeta = {
    ...(trip.meta ?? {}),
    ai_preferences: parsed.data.preferences,
    brief_updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("trips")
    .update({ meta: nextMeta })
    .eq("id", parsed.data.tripId);

  if (error) return { error: "Could not save preferences." };

  revalidatePath(`/trips/${trip.slug}`);
  revalidatePath(`/trips/${trip.slug}/admin`);
  return { ok: true };
}
