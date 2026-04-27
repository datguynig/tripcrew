/**
 * Debug script — run the same enrichPlace pipeline that the destinations
 * page backfill uses, against Rio + Barcelona, with timing per step.
 * Helps isolate whether the silent failure is the code itself or the
 * Vercel `after()` execution window.
 *
 * Usage: pnpm tsx --env-file=.env.local scripts/debug-enrich.ts
 */
import { enrichPlace } from "@/lib/placeEnrichment";
import { placesEnabled } from "@/lib/places";

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  const result = await fn();
  console.log(`[${Date.now() - start}ms] ${label}`);
  return result;
}

async function main() {
  console.log("placesEnabled():", placesEnabled());
  console.log("");

  for (const place of [
    { name: "Rio de Janeiro", latitude: -22.9068, longitude: -43.1729 },
    { name: "Barcelona", latitude: 41.3851, longitude: 2.1734 },
  ]) {
    console.log(`=== ${place.name} ===`);
    const result = await timed(`enrichPlace(${place.name})`, () =>
      enrichPlace({ ...place, radiusMeters: 50_000 }),
    );
    console.log("photoUrl:", result.photoUrl ?? "<null>");
    console.log("photoAttribution:", result.photoAttribution ?? "<null>");
    console.log("rating:", result.rating);
    console.log("priceLevel:", result.priceLevel);
    console.log("tint:", result.tint ?? "<null>");
    console.log("");
  }
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
