import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Trip } from "@/lib/types";
import { TRIP_SLUG } from "@/lib/types";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, joined_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return profile ? { id: user.id, email: user.email, profile } : null;
});

export const getTrip = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trips")
    .select("id, slug, name, start_date, end_date, target_crew_size, created_at")
    .eq("slug", TRIP_SLUG)
    .single<Trip>();
  return data;
});

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
