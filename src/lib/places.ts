/**
 * Google Places (New) API wrapper — used during AI draft generation
 * to ground itinerary suggestions in real venues.
 *
 * Why "New": the legacy Places API is deprecated. The New API has
 * different endpoints, a field-mask auth header, and POST-only Text
 * Search. Docs: https://developers.google.com/maps/documentation/places/web-service/overview
 *
 * Two endpoints:
 * - searchText: free-text query → ranked venue candidates
 * - getPlaceDetails: place id → full details (hours, website, phone)
 *
 * Auth: API key via X-Goog-Api-Key. Key should be restricted by HTTP
 * referrer in GCP for client-side calls; this wrapper runs server-side
 * only (never import into a "use client" file).
 *
 * Cost control: field mask is tuned tight — we pay per returned field
 * category. See https://developers.google.com/maps/billing-and-pricing/new-sku
 */

const API_ROOT = "https://places.googleapis.com/v1";
const SEARCH_TEXT_URL = `${API_ROOT}/places:searchText`;
const PLACES_BASE = `${API_ROOT}/places`;

// Tight field mask: only what the AI needs to ground itinerary items.
// Adding a field bumps you into a higher SKU tier — change deliberately.
// `places.photos.*` pulls the first-photo reference + author attribution
// which we then resolve via fetchPlacePhoto below; the photo field adds
// to the Text Search SKU tier (Pro Essentials).
const SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.primaryTypeDisplayName",
  "places.photos.name",
  "places.photos.widthPx",
  "places.photos.heightPx",
  "places.photos.authorAttributions.displayName",
  "places.websiteUri",
].join(",");

const DETAIL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "priceLevel",
  "regularOpeningHours",
  "websiteUri",
  "internationalPhoneNumber",
  "primaryTypeDisplayName",
].join(",");

export type PlacePhotoRef = {
  // Opaque resource name, e.g. "places/ChIJ.../photos/AeeoHcK..." —
  // pass verbatim to fetchPlacePhoto to resolve a redirect URL.
  name: string;
  widthPx: number | null;
  heightPx: number | null;
  authorAttribution: string | null;
};

export type PlaceResult = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  userRatingCount: number | null;
  priceLevel: string | null;
  primaryType: string | null;
  website: string | null;
  photos: PlacePhotoRef[];
};

export type PlaceDetails = PlaceResult & {
  openingHours: string[] | null;
  phone: string | null;
};

function apiKey() {
  return process.env.GOOGLE_PLACES_API_KEY ?? "";
}

export function placesEnabled(): boolean {
  return apiKey().length > 0;
}

type RawPhoto = {
  name?: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: Array<{ displayName?: string }>;
};

type RawPlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  primaryTypeDisplayName?: { text?: string };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  websiteUri?: string;
  internationalPhoneNumber?: string;
  photos?: RawPhoto[];
};

function mapPhotos(raw: RawPhoto[] | undefined): PlacePhotoRef[] {
  if (!raw || raw.length === 0) return [];
  return raw
    .filter((p): p is RawPhoto & { name: string } => Boolean(p.name))
    .map((p) => ({
      name: p.name,
      widthPx: p.widthPx ?? null,
      heightPx: p.heightPx ?? null,
      authorAttribution: p.authorAttributions?.[0]?.displayName ?? null,
    }));
}

function mapPlace(p: RawPlace): PlaceResult {
  return {
    id: p.id ?? "",
    name: p.displayName?.text ?? "",
    address: p.formattedAddress ?? "",
    latitude: p.location?.latitude ?? null,
    longitude: p.location?.longitude ?? null,
    rating: p.rating ?? null,
    userRatingCount: p.userRatingCount ?? null,
    priceLevel: p.priceLevel ?? null,
    primaryType: p.primaryTypeDisplayName?.text ?? null,
    website: p.websiteUri ?? null,
    photos: mapPhotos(p.photos),
  };
}

function mapDetails(p: RawPlace): PlaceDetails {
  return {
    ...mapPlace(p),
    openingHours: p.regularOpeningHours?.weekdayDescriptions ?? null,
    phone: p.internationalPhoneNumber ?? null,
  };
}

type SearchOpts = {
  // Location bias — latitude + longitude + radius in meters. Required
  // for useful results; otherwise Google returns globally-popular
  // matches which are rarely what a trip planner wants.
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  maxResults?: number;
  signal?: AbortSignal;
};

type AirportSearchOpts = {
  maxResults?: number;
  signal?: AbortSignal;
};

/**
 * Free-text place search with optional location bias. Returns up to
 * `maxResults` (default 8) candidates. Returns [] if the API key is
 * missing or the request fails — callers should degrade gracefully.
 */
export async function searchText(
  query: string,
  opts: SearchOpts,
): Promise<PlaceResult[]> {
  const key = apiKey();
  if (!key || !query.trim()) return [];

  const body = {
    textQuery: query,
    maxResultCount: Math.min(opts.maxResults ?? 8, 20),
    locationBias: {
      circle: {
        center: { latitude: opts.latitude, longitude: opts.longitude },
        radius: opts.radiusMeters ?? 15_000,
      },
    },
  };

  const res = await fetch(SEARCH_TEXT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": SEARCH_FIELDS,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) return [];
  const data = (await res.json()) as { places?: RawPlace[] };
  return (data.places ?? []).map(mapPlace);
}

/**
 * Airport-typed text search. Used by the "Draft with AI" preferences
 * modal to pick a crew origin airport. No location bias — airports
 * are searched globally; the query usually carries enough specificity
 * ("heathrow", "LHR", "jfk new york").
 */
export async function searchAirports(
  query: string,
  opts: AirportSearchOpts = {},
): Promise<PlaceResult[]> {
  const key = apiKey();
  if (!key || !query.trim()) return [];

  const body = {
    textQuery: query,
    includedType: "airport",
    maxResultCount: Math.min(opts.maxResults ?? 6, 10),
  };

  const res = await fetch(SEARCH_TEXT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": SEARCH_FIELDS,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) return [];
  const data = (await res.json()) as { places?: RawPlace[] };
  return (data.places ?? []).map(mapPlace);
}

/**
 * Resolve a Places photo reference into a short-lived HTTPS URL that
 * actually serves the image bytes. Google's Photo API redirects to a
 * CDN URL with a ~1-hour TTL; `skipHttpRedirect=true` returns the
 * redirect target as JSON instead of a 302 so we can refetch and
 * persist the payload to our own storage bucket.
 *
 * Returns null on failure — callers must tolerate a missing photo.
 * Cost: Photos API is $7/1k requests (cheapest Places SKU).
 */
export async function fetchPlacePhoto(
  photoName: string,
  maxWidthPx = 1200,
): Promise<string | null> {
  const key = apiKey();
  if (!key || !photoName) return null;

  const url =
    `${API_ROOT}/${photoName}/media` +
    `?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`;

  const res = await fetch(url, {
    headers: { "X-Goog-Api-Key": key },
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { photoUri?: string };
  return data.photoUri ?? null;
}

/**
 * Fetch full details for a place ID returned by searchText. Use
 * sparingly — Details is a pricier SKU than Search.
 */
export async function getPlaceDetails(
  placeId: string,
): Promise<PlaceDetails | null> {
  const key = apiKey();
  if (!key || !placeId) return null;

  const res = await fetch(`${PLACES_BASE}/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": DETAIL_FIELDS,
    },
  });

  if (!res.ok) return null;
  const data = (await res.json()) as RawPlace;
  return mapDetails(data);
}
