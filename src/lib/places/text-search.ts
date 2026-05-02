import { getCached, setCached } from "@/lib/places/cache";
import { placesRequestWithRetry } from "@/lib/places/client";
import { mapToSummary, type PlaceSummary, type RawPlace } from "@/lib/places/types";

export interface LocationBias {
  circle: {
    center: { latitude: number; longitude: number };
    radius: number;
  };
}

export interface TextSearchParams {
  query: string;
  maxResults?: number;
  languageCode?: string;
  regionCode?: string;
  locationBias?: LocationBias;
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
  "places.websiteUri",
  "places.googleMapsUri",
].join(",");

export async function textSearch(
  params: TextSearchParams,
): Promise<PlaceSummary[]> {
  const cacheParams = { ...params };
  const cached = await getCached<PlaceSummary[]>("text", cacheParams);
  if (cached) return cached;

  const response = await placesRequestWithRetry<{ places?: RawPlace[] }>({
    path: "/v1/places:searchText",
    method: "POST",
    fieldMask: SUMMARY_FIELD_MASK,
    body: {
      textQuery: params.query,
      maxResultCount: params.maxResults ?? 10,
      languageCode: params.languageCode ?? "en",
      regionCode: params.regionCode,
      ...(params.locationBias ? { locationBias: params.locationBias } : {}),
    },
  });

  const results = (response.places ?? []).map(mapToSummary);
  await setCached("text", cacheParams, results);
  return results;
}
