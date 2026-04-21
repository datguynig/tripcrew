/**
 * One-off media backfill. Enriches pre-existing rows that pre-date
 * the media-enrichment feature:
 *   1. Every destination_candidate with lat/lng and no photo_url
 *   2. Every locked trip with no hero_image_url — fills from the
 *      winning candidate's photo (fetching fresh if needed)
 *
 * Idempotent — re-running skips already-enriched rows.
 * Logs progress + final Places Photo API cost.
 *
 *   pnpm backfill:media
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import sharp from "sharp";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!PLACES_KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY — cannot enrich");
  process.exit(1);
}

const BUCKET = "place-photos";
const PHOTO_WIDTH = 1200;
const API_ROOT = "https://places.googleapis.com/v1";
const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// Tracked so we can report rough cost at the end. Photos API is
// $7/1k requests; Text Search is $32/1k. We call one of each per row.
let textSearchCount = 0;
let photoCount = 0;

type EnrichResult = {
  photoUrl: string | null;
  photoAttribution: string | null;
  rating: number | null;
  priceLevel: number | null;
  website: string | null;
  tint: string | null;
};

async function extractDominantTint(
  buffer: Uint8Array,
): Promise<string | null> {
  try {
    const { dominant } = await sharp(buffer).stats();
    if (!dominant) return null;
    const { r, g, b } = dominant;
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.10)`;
  } catch {
    return null;
  }
}

type PlacePhoto = {
  name?: string;
  authorAttributions?: Array<{ displayName?: string }>;
};

type PlaceHit = {
  rating?: number;
  priceLevel?: string;
  websiteUri?: string;
  photos?: PlacePhoto[];
};

function storageKey(name: string, lat: number, lng: number): string {
  const hash = createHash("sha256")
    .update(`${name.trim().toLowerCase()}|${lat.toFixed(3)}|${lng.toFixed(3)}`)
    .digest("hex")
    .slice(0, 24);
  return `${hash}.jpg`;
}

async function searchTop(
  name: string,
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<PlaceHit | null> {
  const body = {
    textQuery: name,
    maxResultCount: 1,
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusMeters,
      },
    },
  };
  textSearchCount++;
  const res = await fetch(`${API_ROOT}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": PLACES_KEY!,
      "X-Goog-FieldMask": [
        "places.rating",
        "places.priceLevel",
        "places.websiteUri",
        "places.photos.name",
        "places.photos.authorAttributions.displayName",
      ].join(","),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { places?: PlaceHit[] };
  return data.places?.[0] ?? null;
}

async function fetchPhotoUri(photoName: string): Promise<string | null> {
  photoCount++;
  const url =
    `${API_ROOT}/${photoName}/media?maxWidthPx=${PHOTO_WIDTH}&skipHttpRedirect=true`;
  const res = await fetch(url, {
    headers: { "X-Goog-Api-Key": PLACES_KEY! },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { photoUri?: string };
  return data.photoUri ?? null;
}

async function downloadToBucket(
  supabase: SupabaseClient,
  photoUri: string,
  key: string,
): Promise<{ url: string; tint: string | null } | null> {
  const res = await fetch(photoUri);
  if (!res.ok) return null;
  const buffer = new Uint8Array(await res.arrayBuffer());
  const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
    contentType: res.headers.get("content-type") ?? "image/jpeg",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    console.error(`  upload failed: ${error.message}`);
    return null;
  }
  const url = supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
  const tint = await extractDominantTint(buffer);
  return { url, tint };
}

async function enrich(
  supabase: SupabaseClient,
  name: string,
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<EnrichResult> {
  const hit = await searchTop(name, lat, lng, radiusMeters);
  if (!hit) {
    return {
      photoUrl: null,
      photoAttribution: null,
      rating: null,
      priceLevel: null,
      website: null,
      tint: null,
    };
  }
  const rating = hit.rating ?? null;
  const priceLevel = hit.priceLevel ? PRICE_LEVEL_MAP[hit.priceLevel] ?? null : null;
  const website = hit.websiteUri ?? null;
  const photoRef = hit.photos?.[0];
  if (!photoRef?.name) {
    return {
      photoUrl: null,
      photoAttribution: null,
      rating,
      priceLevel,
      website,
      tint: null,
    };
  }
  const uri = await fetchPhotoUri(photoRef.name);
  const downloaded = uri
    ? await downloadToBucket(supabase, uri, storageKey(name, lat, lng))
    : null;
  return {
    photoUrl: downloaded?.url ?? null,
    photoAttribution: photoRef.authorAttributions?.[0]?.displayName ?? null,
    rating,
    priceLevel,
    website,
    tint: downloaded?.tint ?? null,
  };
}

async function backfillCandidates(supabase: SupabaseClient) {
  const { data: rows, error } = await supabase
    .from("destination_candidates")
    .select("id, title, latitude, longitude")
    .is("photo_url", null)
    .not("latitude", "is", null)
    .not("longitude", "is", null);
  if (error) throw error;
  if (!rows || rows.length === 0) {
    console.log("Candidates: none to backfill");
    return 0;
  }
  console.log(`Candidates: enriching ${rows.length}`);
  let ok = 0;
  for (const row of rows) {
    const lat = row.latitude as number;
    const lng = row.longitude as number;
    const result = await enrich(supabase, row.title, lat, lng, 50_000);
    if (!result.photoUrl) {
      console.log(`  ${row.title} — no photo available`);
      continue;
    }
    const { error: updErr } = await supabase
      .from("destination_candidates")
      .update({
        photo_url: result.photoUrl,
        photo_attribution: result.photoAttribution,
      })
      .eq("id", row.id);
    if (updErr) {
      console.error(`  ${row.title} — update failed: ${updErr.message}`);
      continue;
    }
    ok++;
    console.log(`  ${row.title} ✓`);
  }
  return ok;
}

async function backfillLockedTrips(supabase: SupabaseClient) {
  const { data: trips, error } = await supabase
    .from("trips")
    .select("id, name, destination")
    .eq("status", "locked")
    .is("hero_image_url", null);
  if (error) throw error;
  if (!trips || trips.length === 0) {
    console.log("Locked trips: none to backfill");
    return 0;
  }
  console.log(`Locked trips: enriching ${trips.length}`);
  let ok = 0;
  for (const trip of trips) {
    if (!trip.destination) {
      console.log(`  ${trip.name} — no destination set`);
      continue;
    }
    // Prefer the winning candidate's coords; fall back to any sibling.
    const { data: cand } = await supabase
      .from("destination_candidates")
      .select("title, latitude, longitude, photo_url, photo_attribution")
      .eq("trip_id", trip.id)
      .eq("title", trip.destination)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .maybeSingle<{
        title: string;
        latitude: number | null;
        longitude: number | null;
        photo_url: string | null;
        photo_attribution: string | null;
      }>();
    if (!cand || cand.latitude === null || cand.longitude === null) {
      console.log(`  ${trip.name} — no candidate coords for ${trip.destination}`);
      continue;
    }
    let heroUrl = cand.photo_url;
    let heroAttribution = cand.photo_attribution;
    let heroTint: string | null = null;
    if (!heroUrl) {
      const result = await enrich(
        supabase,
        cand.title,
        cand.latitude,
        cand.longitude,
        50_000,
      );
      heroUrl = result.photoUrl;
      heroAttribution = result.photoAttribution;
      heroTint = result.tint;
    } else {
      // Photo already cached; re-fetch from our bucket to extract
      // the tint without burning Places API quota.
      heroTint = await tintFromUrl(heroUrl);
    }
    if (!heroUrl) {
      console.log(`  ${trip.name} — enrichment returned no photo`);
      continue;
    }
    const { error: updErr } = await supabase
      .from("trips")
      .update({
        hero_image_url: heroUrl,
        hero_image_attribution: heroAttribution,
        hero_tint: heroTint,
      })
      .eq("id", trip.id);
    if (updErr) {
      console.error(`  ${trip.name} — update failed: ${updErr.message}`);
      continue;
    }
    ok++;
    console.log(`  ${trip.name} ✓ (${trip.destination})`);
  }
  return ok;
}

async function tintFromUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = new Uint8Array(await res.arrayBuffer());
    return await extractDominantTint(buffer);
  } catch {
    return null;
  }
}

async function backfillTintsForExistingHeroes(supabase: SupabaseClient) {
  const { data: trips, error } = await supabase
    .from("trips")
    .select("id, name, hero_image_url")
    .not("hero_image_url", "is", null)
    .is("hero_tint", null);
  if (error) throw error;
  if (!trips || trips.length === 0) {
    console.log("Tints: none to backfill");
    return 0;
  }
  console.log(`Tints: extracting for ${trips.length} trips`);
  let ok = 0;
  for (const trip of trips) {
    if (!trip.hero_image_url) continue;
    const tint = await tintFromUrl(trip.hero_image_url);
    if (!tint) {
      console.log(`  ${trip.name} — tint extraction failed`);
      continue;
    }
    const { error: updErr } = await supabase
      .from("trips")
      .update({ hero_tint: tint })
      .eq("id", trip.id);
    if (updErr) {
      console.error(`  ${trip.name} — update failed: ${updErr.message}`);
      continue;
    }
    ok++;
    console.log(`  ${trip.name} ✓ ${tint}`);
  }
  return ok;
}

async function backfillActivities(supabase: SupabaseClient) {
  // Activities don't carry coords; we derive them from the winning
  // destination candidate per trip. One Places search + one photo
  // fetch per activity. Skips rows already enriched.
  const { data: rows, error } = await supabase
    .from("activities")
    .select("id, trip_id, title")
    .is("photo_url", null);
  if (error) throw error;
  if (!rows || rows.length === 0) {
    console.log("Activities: none to backfill");
    return 0;
  }
  console.log(`Activities: enriching ${rows.length}`);

  const coordCache = new Map<
    string,
    { latitude: number; longitude: number } | null
  >();
  const coordsFor = async (tripId: string) => {
    if (coordCache.has(tripId)) return coordCache.get(tripId) ?? null;
    const { data: trip } = await supabase
      .from("trips")
      .select("destination")
      .eq("id", tripId)
      .maybeSingle<{ destination: string | null }>();
    if (!trip?.destination) {
      coordCache.set(tripId, null);
      return null;
    }
    const { data: cand } = await supabase
      .from("destination_candidates")
      .select("latitude, longitude")
      .eq("trip_id", tripId)
      .eq("title", trip.destination)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .maybeSingle<{ latitude: number; longitude: number }>();
    const coords = cand
      ? { latitude: cand.latitude, longitude: cand.longitude }
      : null;
    coordCache.set(tripId, coords);
    return coords;
  };

  let ok = 0;
  for (const row of rows) {
    const coords = await coordsFor(row.trip_id as string);
    if (!coords) {
      console.log(`  ${row.title} — trip has no destination coords`);
      continue;
    }
    const result = await enrich(
      supabase,
      row.title,
      coords.latitude,
      coords.longitude,
      25_000,
    );
    if (!result.photoUrl) {
      console.log(`  ${row.title} — no photo available`);
      continue;
    }
    const { error: updErr } = await supabase
      .from("activities")
      .update({
        photo_url: result.photoUrl,
        photo_attribution: result.photoAttribution,
        rating: result.rating,
        price_level: result.priceLevel,
        website_url: result.website,
      })
      .eq("id", row.id);
    if (updErr) {
      console.error(`  ${row.title} — update failed: ${updErr.message}`);
      continue;
    }
    ok++;
    console.log(`  ${row.title} ✓`);
  }
  return ok;
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!);
  console.log("Backfilling candidate photos…");
  const candidatesEnriched = await backfillCandidates(supabase);
  console.log("");
  console.log("Backfilling locked-trip heroes…");
  const heroesEnriched = await backfillLockedTrips(supabase);
  console.log("");
  console.log("Backfilling tints for already-enriched heroes…");
  const tintsBackfilled = await backfillTintsForExistingHeroes(supabase);
  console.log("");
  console.log("Backfilling activity photos…");
  const activitiesEnriched = await backfillActivities(supabase);
  console.log("");
  console.log(
    `Done · candidates ${candidatesEnriched} · heroes ${heroesEnriched} · tints ${tintsBackfilled} · activities ${activitiesEnriched}`,
  );
  const cost = textSearchCount * 0.032 + photoCount * 0.007;
  console.log(
    `Places cost · ${textSearchCount} text-search · ${photoCount} photos · $${cost.toFixed(3)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
