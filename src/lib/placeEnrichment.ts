/**
 * Place enrichment — server-side only. Runs during destination proposal,
 * destination lock, and AI draft generation. Hydrates a row with a
 * Google Places photo (downloaded into our `place-photos` storage
 * bucket) plus rating / price level / website.
 *
 * Never throws. Returns nulls on any failure so callers can persist a
 * partial row (e.g. rating-only) without blowing up the parent action.
 *
 * Why we download instead of hotlinking: Places Photo API returns a
 * short-lived CDN URL (~1h TTL); re-fetching on every render would
 * burn the Photos SKU and hit rate limits. Copying once into our
 * bucket gives us a stable, long-lived public URL.
 *
 * **Do not import into a "use client" file.** This wraps the
 * service-role Supabase client and hits Google APIs with our key.
 */

import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  fetchPlacePhoto,
  placesEnabled,
  searchText,
  type PlaceResult,
} from "@/lib/places";
import { createServiceClient } from "@/lib/supabase/server";

const BUCKET = "place-photos";
const PHOTO_WIDTH = 1200;
const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export type EnrichInput = {
  name: string;
  latitude: number;
  longitude: number;
  // Search radius in meters. City-level hero lookups want a wider
  // radius than venue-level activity lookups. Defaults suit activities.
  radiusMeters?: number;
};

export type EnrichResult = {
  photoUrl: string | null;
  photoAttribution: string | null;
  rating: number | null;
  priceLevel: number | null;
  website: string | null;
  // Low-alpha `rgba(...)` string derived from the photo's dominant
  // colour. Powers the per-trip atmospheric radial. Null when no
  // photo lands or extraction fails.
  tint: string | null;
};

const EMPTY: EnrichResult = {
  photoUrl: null,
  photoAttribution: null,
  rating: null,
  priceLevel: null,
  website: null,
  tint: null,
};

function storageKey(input: EnrichInput): string {
  const lat = input.latitude.toFixed(3);
  const lng = input.longitude.toFixed(3);
  const hash = createHash("sha256")
    .update(`${input.name.trim().toLowerCase()}|${lat}|${lng}`)
    .digest("hex")
    .slice(0, 24);
  return `${hash}.jpg`;
}

async function extractDominantTint(
  buffer: Uint8Array,
): Promise<string | null> {
  try {
    const { dominant } = await sharp(buffer).stats();
    if (!dominant) return null;
    const { r, g, b } = dominant;
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.10)`;
  } catch (err) {
    console.error("extractDominantTint failed", err);
    return null;
  }
}

async function downloadToBucket(
  photoUri: string,
  key: string,
): Promise<{ url: string; tint: string | null } | null> {
  const res = await fetch(photoUri);
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = new Uint8Array(await res.arrayBuffer());

  const service = createServiceClient();
  const { error } = await service.storage.from(BUCKET).upload(key, buffer, {
    contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  // "Duplicate" errors mean a prior call already cached this exact key —
  // deterministic keys are the whole point, so that's a success.
  if (error && !/already exists|duplicate/i.test(error.message)) {
    console.error("place-photos upload failed", error);
    return null;
  }
  const { data } = service.storage.from(BUCKET).getPublicUrl(key);
  const tint = await extractDominantTint(buffer);
  return { url: data.publicUrl, tint };
}

export async function enrichPlace(input: EnrichInput): Promise<EnrichResult> {
  if (!placesEnabled()) return EMPTY;
  if (!input.name.trim()) return EMPTY;

  let hits: PlaceResult[] = [];
  try {
    hits = await searchText(input.name, {
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters: input.radiusMeters ?? 15_000,
      maxResults: 1,
    });
  } catch (err) {
    console.error("enrichPlace searchText failed", err);
    return EMPTY;
  }

  const top = hits[0];
  if (!top) return EMPTY;

  const rating = top.rating;
  const priceLevel = top.priceLevel
    ? PRICE_LEVEL_MAP[top.priceLevel] ?? null
    : null;
  const website = top.website;

  const photoRef = top.photos[0];
  if (!photoRef) {
    return {
      photoUrl: null,
      photoAttribution: null,
      rating,
      priceLevel,
      website,
      tint: null,
    };
  }

  let photoUrl: string | null = null;
  let tint: string | null = null;
  try {
    const uri = await fetchPlacePhoto(photoRef.name, PHOTO_WIDTH);
    if (uri) {
      const downloaded = await downloadToBucket(uri, storageKey(input));
      if (downloaded) {
        photoUrl = downloaded.url;
        tint = downloaded.tint;
      }
    }
  } catch (err) {
    console.error("enrichPlace photo fetch failed", err);
  }

  return {
    photoUrl,
    photoAttribution: photoRef.authorAttribution,
    rating,
    priceLevel,
    website,
    tint,
  };
}
