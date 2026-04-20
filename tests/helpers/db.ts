import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for test fixtures. Bypasses RLS so we
 * can seed state that's normally only writable by the server actions
 * (AI draft output, ai_drafted markers, etc.) without running the
 * real Gemini + Places pipeline.
 */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srk) {
    throw new Error(
      "adminClient(): NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required in .env.local",
    );
  }
  return createClient(url, srk, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getTripIdBySlug(slug: string): Promise<string> {
  const { data, error } = await adminClient()
    .from("trips")
    .select("id")
    .eq("slug", slug)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  if (!data) throw new Error(`Trip not found by slug: ${slug}`);
  return data.id;
}

/**
 * Stamps a locked trip as if the AI draft had run: hero + meta
 * (spec_grid, schedule) + ai_drafted_at on the trip, plus one
 * ai_drafted activity and one ai_drafted booking so the reset path
 * has real rows to delete.
 */
export async function seedAiDraft(tripId: string) {
  const admin = adminClient();

  const meta = {
    spec_grid: [
      { label: "City", value: "Test City", sub: "fixture" },
      { label: "Vibe", value: "Mid", sub: "fixture" },
      { label: "Crew", value: "4", sub: "fixture" },
      { label: "Budget", value: "£950 pp", sub: "fixture" },
    ],
    schedule: [
      {
        day_label: "Day 1",
        heading: "Arrive & settle in.",
        body: "Fixture schedule body.",
      },
      {
        day_label: "Day 2",
        heading: "Wander the old town.",
        body: "Fixture schedule body.",
      },
    ],
  };

  const { error: tErr } = await admin
    .from("trips")
    .update({
      hero_title: "Fixture hero title.",
      hero_subtitle: "Fixture hero subtitle.",
      ai_drafted_at: new Date().toISOString(),
      meta,
    })
    .eq("id", tripId);
  if (tErr) throw tErr;

  const { error: aErr } = await admin.from("activities").insert({
    trip_id: tripId,
    title: "Fixture AI activity",
    meta: "fixture",
    category: "day",
    position: 9001,
    ai_drafted: true,
  });
  if (aErr) throw aErr;

  const { error: bErr } = await admin.from("bookings").insert({
    trip_id: tripId,
    title: "Fixture AI booking",
    position: 9001,
    ai_drafted: true,
  });
  if (bErr) throw bErr;
}

export async function setAiEnabledByEmail(email: string, enabled: boolean) {
  const admin = adminClient();
  const { data: list, error: lErr } = await admin.auth.admin.listUsers();
  if (lErr) throw lErr;
  const user = list.users.find((u) => u.email === email);
  if (!user) throw new Error(`User not found: ${email}`);
  const { error } = await admin
    .from("profiles")
    .update({ ai_enabled: enabled })
    .eq("id", user.id);
  if (error) throw error;
}

export async function readTripAiState(tripId: string) {
  const admin = adminClient();
  const [{ data: trip }, { data: acts }, { data: books }] = await Promise.all([
    admin
      .from("trips")
      .select("status, hero_title, hero_subtitle, ai_drafted_at, meta")
      .eq("id", tripId)
      .maybeSingle<{
        status: string;
        hero_title: string | null;
        hero_subtitle: string | null;
        ai_drafted_at: string | null;
        meta: Record<string, unknown> | null;
      }>(),
    admin
      .from("activities")
      .select("id, ai_drafted")
      .eq("trip_id", tripId)
      .eq("ai_drafted", true),
    admin
      .from("bookings")
      .select("id, ai_drafted")
      .eq("trip_id", tripId)
      .eq("ai_drafted", true),
  ]);
  return {
    trip,
    aiActivityCount: acts?.length ?? 0,
    aiBookingCount: books?.length ?? 0,
  };
}
