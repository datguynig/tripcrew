import { textSearch } from "@/lib/places/text-search";

export type ResolvedPlace = {
  place_id: string;
  maps_url: string;
  website_url: string | null;
};

type PlaceSearchResult = {
  id: string;
  location: { latitude: number; longitude: number };
  googleMapsUri?: string;
  websiteUri?: string | null;
};

export type PlaceSearchFn = (query: string) => Promise<PlaceSearchResult[]>;

const DEFAULT_MAX_LOOKUPS = 25;

function isValidName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 80;
}

function isValidHttpUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

// Haversine distance in metres.
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export async function resolvePlaceNames(
  names: string[],
  destinationLatLng: { lat: number; lng: number },
  radiusMeters: number,
  options: { searchText?: PlaceSearchFn; maxLookups?: number } = {},
): Promise<Map<string, ResolvedPlace>> {
  const search: PlaceSearchFn =
    options.searchText ??
    (async (query) => {
      const results = await textSearch({ query, maxResults: 1 });
      // NOTE: this default path does NOT pass locationBias to Places, so
      // the distance filter at line 100 may discard the top-1 result for
      // common names (e.g. "Central Park" near Stockholm). Task 5 (lockAndDraft)
      // MUST supply a bias-aware PlaceSearchFn via options.searchText —
      // don't rely on this default in production.
      return results.map((r) => ({
        id: r.id,
        location: { latitude: r.location.latitude, longitude: r.location.longitude },
        googleMapsUri: `https://www.google.com/maps/place/?q=place_id:${r.id}`,
        websiteUri: null,
      }));
    });

  const maxLookups = options.maxLookups ?? DEFAULT_MAX_LOOKUPS;

  const seen = new Set<string>();
  const queue: string[] = [];
  for (const raw of names) {
    if (!isValidName(raw)) continue;
    const key = raw.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push(raw.trim());
    if (queue.length >= maxLookups) break;
  }

  const out = new Map<string, ResolvedPlace>();

  for (const name of queue) {
    let results: PlaceSearchResult[];
    try {
      results = await search(name);
    } catch (err) {
      console.error("[resolvePlaceNames] search threw, skipping", name, err);
      continue;
    }
    const top = results[0];
    if (!top) continue;
    const dist = distanceMeters(destinationLatLng, {
      lat: top.location.latitude,
      lng: top.location.longitude,
    });
    if (dist > radiusMeters) continue;
    if (!top.id) continue;
    const mapsUri = top.googleMapsUri ?? null;
    const websiteUri = top.websiteUri ?? null;
    out.set(name, {
      place_id: top.id,
      maps_url: isValidHttpUrl(mapsUri)
        ? mapsUri
        : `https://www.google.com/maps/place/?q=place_id:${top.id}`,
      website_url: isValidHttpUrl(websiteUri) ? websiteUri : null,
    });
  }

  return out;
}
