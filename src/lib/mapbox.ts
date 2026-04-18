/**
 * Thin wrapper around Mapbox Search Box API for destination autocomplete.
 * Token lives in NEXT_PUBLIC_MAPBOX_TOKEN — fine to expose client-side
 * because Mapbox tokens are scoped by URL referrer at the token settings.
 *
 * Two endpoints:
 * - suggest:  typed query → list of candidate places
 * - retrieve: selected candidate → full details incl. lon/lat
 *
 * Docs: https://docs.mapbox.com/api/search/search-box/
 */

export type PlaceSuggestion = {
  mapboxId: string;
  name: string;
  placeFormatted: string;
  featureType: string;
};

export type PlaceDetails = {
  mapboxId: string;
  name: string;
  placeFormatted: string;
  longitude: number;
  latitude: number;
  country: string | null;
};

const SEARCH_BOX = "https://api.mapbox.com/search/searchbox/v1";

function token() {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
}

export function mapboxEnabled(): boolean {
  return token().length > 0;
}

/**
 * Session token keeps billing to one "session" across suggest+retrieve.
 * Generate one per user interaction flow (e.g. open search → select).
 */
export function newSessionToken(): string {
  return crypto.randomUUID();
}

export async function suggestPlaces(
  query: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (!q || !mapboxEnabled()) return [];

  const params = new URLSearchParams({
    q,
    language: "en",
    limit: "6",
    // Cities (place) + named areas within cities (locality) only. Regions
    // and countries are too coarse for a trip destination — a user isn't
    // booking a trip to "Senegal the region" vs "Dakar the city".
    types: "place,locality",
    access_token: token(),
    session_token: sessionToken,
  });

  const res = await fetch(`${SEARCH_BOX}/suggest?${params}`, { signal });
  if (!res.ok) return [];
  const data: {
    suggestions?: Array<{
      mapbox_id: string;
      name: string;
      place_formatted?: string;
      feature_type?: string;
    }>;
  } = await res.json();

  return (data.suggestions ?? []).map((s) => ({
    mapboxId: s.mapbox_id,
    name: s.name,
    placeFormatted: s.place_formatted ?? "",
    featureType: s.feature_type ?? "",
  }));
}

export async function retrievePlace(
  mapboxId: string,
  sessionToken: string,
): Promise<PlaceDetails | null> {
  if (!mapboxEnabled()) return null;

  const params = new URLSearchParams({
    access_token: token(),
    session_token: sessionToken,
  });

  const res = await fetch(
    `${SEARCH_BOX}/retrieve/${encodeURIComponent(mapboxId)}?${params}`,
  );
  if (!res.ok) return null;

  const data: {
    features?: Array<{
      properties: {
        mapbox_id: string;
        name: string;
        place_formatted?: string;
        context?: { country?: { name?: string } };
        coordinates: { longitude: number; latitude: number };
      };
    }>;
  } = await res.json();

  const feature = data.features?.[0];
  if (!feature) return null;
  const p = feature.properties;
  return {
    mapboxId: p.mapbox_id,
    name: p.name,
    placeFormatted: p.place_formatted ?? "",
    longitude: p.coordinates.longitude,
    latitude: p.coordinates.latitude,
    country: p.context?.country?.name ?? null,
  };
}
