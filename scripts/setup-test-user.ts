/**
 * Idempotently creates a test user that Playwright signs in as, and
 * makes sure they're a member of the primary test trip.
 *
 * Credentials come from env:
 *   TEST_USER_EMAIL       e.g. playwright@tripcrew.dev
 *   TEST_USER_PASSWORD    strong random; persisted in .env.local
 *   TEST_TRIP_SLUG        the trip this user should be a member of
 *
 * Run:  pnpm tsx scripts/setup-test-user.ts
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.TEST_USER_EMAIL;
const password = process.env.TEST_USER_PASSWORD;
const tripSlug = process.env.TEST_TRIP_SLUG ?? "sweden-summer-2026-9ycp";

if (!url || !srk || !email || !password) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_USER_EMAIL, TEST_USER_PASSWORD in .env.local.",
  );
  process.exit(1);
}

const admin = createClient(url, srk, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function upsertUser(): Promise<string> {
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    console.log(`User exists: ${email} (${existing.id})`);
    await admin.auth.admin.updateUserById(existing.id, { password });
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("create user failed");
  console.log(`Created user: ${email} (${data.user.id})`);
  return data.user.id;
}

async function ensureProfile(userId: string) {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (data) return;
  const { error } = await admin
    .from("profiles")
    .insert({ id: userId, name: "Playwright" });
  if (error) throw error;
  console.log("Profile created (name: Playwright)");
}

async function ensureMembership(userId: string) {
  const { data: trip } = await admin
    .from("trips")
    .select("id")
    .eq("slug", tripSlug)
    .maybeSingle<{ id: string }>();
  if (!trip) {
    console.warn(
      `Trip ${tripSlug} not found. Skipping membership — user can still sign in.`,
    );
    return;
  }
  const { data: mem } = await admin
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", trip.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (mem) {
    console.log(`Already a member of ${tripSlug}`);
    return;
  }
  const { error } = await admin
    .from("trip_members")
    .insert({ trip_id: trip.id, user_id: userId, role: "member" });
  if (error) throw error;
  console.log(`Added to ${tripSlug} as member`);
}

async function main() {
  const userId = await upsertUser();
  await ensureProfile(userId);
  await ensureMembership(userId);
  console.log("\nReady for Playwright.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
