import { getCached, setCached } from "@/lib/places/cache";
import { placesRequestWithRetry } from "@/lib/places/client";
import { mapToDetails, type PlaceDetails, type RawPlace } from "@/lib/places/types";

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "types",
  "primaryType",
  "rating",
  "userRatingCount",
  "priceLevel",
  "formattedAddress",
  "shortFormattedAddress",
  "location",
  "editorialSummary",
  "internationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "regularOpeningHours",
  "reviews",
  "photos",
].join(",");

export async function getPlaceDetails(
  placeId: string,
  languageCode = "en",
): Promise<PlaceDetails | null> {
  const cached = await getCached<PlaceDetails>("details", {
    placeId,
    languageCode,
  });
  if (cached) return cached;

  try {
    const response = await placesRequestWithRetry<RawPlace>({
      path: `/v1/places/${encodeURIComponent(placeId)}`,
      method: "GET",
      fieldMask: DETAILS_FIELD_MASK,
      queryParams: { languageCode },
    });

    const result = mapToDetails(response);
    await setCached("details", { placeId, languageCode }, result);
    return result;
  } catch (err) {
    console.error("getPlaceDetails failed for", placeId, err);
    return null;
  }
}
