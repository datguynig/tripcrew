import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Trip, TripRole } from "@/lib/types";

// `*` instead of an explicit column list so newly-added columns (e.g. a
// future `currency` that arrives via migration) don't break the SELECT
// when the app ships before the migration is applied. Consumers of
// optional-new fields should default gracefully (see currencySymbol).
const TRIP_SELECT = "*";

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

export const getTrip = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trips")
    .select(TRIP_SELECT)
    .eq("slug", slug)
    .maybeSingle<Trip>();
  return data;
});

export const getUserTrips = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("trip_members")
    .select(`role, joined_at, trips!inner(${TRIP_SELECT})`)
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  return (data ?? []).flatMap((row) => {
    const trip = Array.isArray(row.trips)
      ? row.trips[0]
      : (row.trips as Trip | null);
    if (!trip) return [];
    return [{ ...trip, role: row.role as TripRole }];
  });
});

export const getTripMember = cache(
  async (tripId: string, userId: string): Promise<{ role: TripRole } | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("trip_members")
      .select("role")
      .eq("trip_id", tripId)
      .eq("user_id", userId)
      .maybeSingle<{ role: TripRole }>();
    return data;
  },
);

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
