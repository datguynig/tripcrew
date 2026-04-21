/**
 * Delete Playwright-seeded trips that accumulated during test runs.
 *
 * Matches trip names with a known test prefix followed by a 13-digit
 * epoch timestamp — the signature every test helper produces. Real
 * user trips never have this shape, so false positives are near-zero.
 *
 * Dry-run by default. Pass --apply to actually delete.
 *
 * Trip FKs are `on delete cascade`, so deleting the trip row
 * cleans up members, candidates, votes, activities, bookings,
 * expenses, posts, likes, invites, notifications, ai_* tables.
 *
 *   pnpm cleanup:test-trips           # dry-run
 *   pnpm cleanup:test-trips --apply   # for real
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const TEST_PREFIXES = [
  "Lock Test",
  "Hero Edit",
  "Spec Edit",
  "Sub Edit",
  "Sched Edit",
  "Budget Edit",
  "Redraft Rail Test",
  "Redraft Quota Test",
  "Reroll Test",
  "Feedback Retry",
  "Feedback Up",
  "AI Prefs Test",
  "Reset Drafts Test",
  "Unlock Dialog Test",
  "Undo Lock Test",
];

const TEST_RX = new RegExp(
  `^(${TEST_PREFIXES.map((p) => p.replace(/ /g, "\\s")).join("|")})\\s\\d{13}$`,
);

const apply = process.argv.includes("--apply");

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!);

  const { data: trips, error } = await supabase
    .from("trips")
    .select("id, name, slug, status, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const candidates = (trips ?? []).filter((t) => TEST_RX.test(t.name));

  console.log(`Scanned ${trips?.length ?? 0} trips.`);
  console.log(`Matched ${candidates.length} test trips for deletion.`);
  console.log("");

  for (const t of candidates) {
    console.log(`  ${t.slug}  —  ${t.name}  (${t.status})`);
  }

  if (candidates.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  if (!apply) {
    console.log("");
    console.log("DRY RUN · re-run with --apply to delete.");
    return;
  }

  console.log("");
  console.log("Deleting…");
  const ids = candidates.map((t) => t.id);
  const chunkSize = 50;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const slice = ids.slice(i, i + chunkSize);
    const { error: delErr, count } = await supabase
      .from("trips")
      .delete({ count: "exact" })
      .in("id", slice);
    if (delErr) {
      console.error(`  chunk ${i}-${i + slice.length} failed: ${delErr.message}`);
      continue;
    }
    deleted += count ?? 0;
  }
  console.log(`Deleted ${deleted} trips.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
