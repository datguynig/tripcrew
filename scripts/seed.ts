import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data: trips, error: tripsErr } = await supabase
    .from("trips")
    .select("id, slug, name, start_date, end_date, target_crew_size");
  if (tripsErr) throw tripsErr;

  const [{ count: activities }, { count: bookings }, { count: profiles }] =
    await Promise.all([
      supabase.from("activities").select("id", { count: "exact", head: true }),
      supabase.from("bookings").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);

  console.log(`Trips:       ${trips?.length ?? 0}`);
  for (const t of trips ?? []) {
    console.log(
      `  ${t.slug} — ${t.name} (${t.start_date} → ${t.end_date}, crew ${t.target_crew_size})`,
    );
  }
  console.log(`Activities:  ${activities}`);
  console.log(`Bookings:    ${bookings}`);
  console.log(`Profiles:    ${profiles}`);

  const schemaPath = join(process.cwd(), "schema.sql");
  try {
    readFileSync(schemaPath);
    console.log(`\nSchema source: ${schemaPath}`);
  } catch {
    // schema.sql is informational only; migrations live in supabase/migrations.
  }

  console.log("\nDB probe complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
