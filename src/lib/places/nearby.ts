import { getCached, setCached } from "@/lib/places/cache";
import { placesRequestWithRetry } from "@/lib/places/client";
import { mapToSummary, type PlaceSummary, type RawPlace } from "@/lib/places/types";

export interface NearbySearchParams {
  latitude: number;
  longitude: number;
  radius?: number;
  includedTypes?: string[];
  maxResults?: number;
  rankBy?: "POPULARITY" | "DISTANCE";
  languageCode?: string;
}

const SUMMARY_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.types",
  "places.primaryType",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.editorialSummary",
].join(",");

export async function nearbySearch(
  params: NearbySearchParams,
): Promise<PlaceSummary[]> {
  const cacheParams = { ...params };
  const cached = await getCached<PlaceSummary[]>("nearby", cacheParams);
  if (cached) return cached;

  const response = await placesRequestWithRetry<{ places?: RawPlace[] }>({
    path: "/v1/places:searchNearby",
    method: "POST",
    fieldMask: SUMMARY_FIELD_MASK,
    body: {
      locationRestriction: {
        circle: {
          center: { latitude: params.latitude, longitude: params.longitude },
          radius: Math.min(params.radius ?? 5000, 50_000),
        },
      },
      includedTypes: params.includedTypes,
      maxResultCount: params.maxResults ?? 15,
      rankPreference: params.rankBy ?? "POPULARITY",
      languageCode: params.languageCode ?? "en",
    },
  });

  const results = (response.places ?? []).map(mapToSummary);
  await setCached("nearby", cacheParams, results);
  return results;
}
