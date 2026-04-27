import { getPlaceDetails } from "@/lib/places/details";
import { nearbySearch } from "@/lib/places/nearby";
import { textSearch } from "@/lib/places/text-search";
import type { PlaceDetails, PlaceSummary } from "@/lib/places/types";

export interface DestinationContext {
  destination: string;
  languageCode?: string;
  regionCode?: string;
}

export interface EnrichedDestination {
  resolved: PlaceSummary | null;
  neighbourhoods: PlaceSummary[];
  topAttractions: PlaceDetails[];
  museums: PlaceSummary[];
  restaurants: PlaceSummary[];
  nightlife: PlaceSummary[];
  placesCalls: number;
  errors: Array<{ source: string; message: string }>;
}

function messageFromError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function enrichDestination(
  ctx: DestinationContext,
): Promise<EnrichedDestination> {
  const errors: Array<{ source: string; message: string }> = [];
  let placesCalls = 0;

  const destSearch = await textSearch({
    query: ctx.destination,
    maxResults: 1,
    languageCode: ctx.languageCode,
    regionCode: ctx.regionCode,
  }).catch((err) => {
    errors.push({
      source: "destination_resolve",
      message: messageFromError(err),
    });
    return [] as PlaceSummary[];
  });
  placesCalls++;

  const resolved = destSearch[0] ?? null;
  if (!resolved) {
    return {
      resolved: null,
      neighbourhoods: [],
      topAttractions: [],
      museums: [],
      restaurants: [],
      nightlife: [],
      placesCalls,
      errors: [
        ...errors,
        { source: "destination_resolve", message: "Destination not found" },
      ],
    };
  }

  const { latitude, longitude } = resolved.location;
  const [
    neighbourhoodsResult,
    attractionsResult,
    museumsResult,
    restaurantsResult,
    nightlifeResult,
  ] = await Promise.allSettled([
    textSearch({
      query: `popular neighbourhoods in ${ctx.destination}`,
      maxResults: 5,
      languageCode: ctx.languageCode,
    }),
    nearbySearch({
      latitude,
      longitude,
      radius: 8000,
      includedTypes: ["tourist_attraction"],
      maxResults: 10,
      rankBy: "POPULARITY",
      languageCode: ctx.languageCode,
    }),
    nearbySearch({
      latitude,
      longitude,
      radius: 8000,
      includedTypes: ["museum", "art_gallery"],
      maxResults: 5,
      rankBy: "POPULARITY",
      languageCode: ctx.languageCode,
    }),
    nearbySearch({
      latitude,
      longitude,
      radius: 5000,
      includedTypes: ["restaurant"],
      maxResults: 10,
      rankBy: "POPULARITY",
      languageCode: ctx.languageCode,
    }),
    nearbySearch({
      latitude,
      longitude,
      radius: 5000,
      includedTypes: ["bar", "night_club"],
      maxResults: 5,
      rankBy: "POPULARITY",
      languageCode: ctx.languageCode,
    }),
  ]);
  placesCalls += 5;

  const collect = <T>(result: PromiseSettledResult<T[]>, source: string): T[] => {
    if (result.status === "fulfilled") return result.value;
    errors.push({ source, message: messageFromError(result.reason) });
    return [];
  };

  const neighbourhoods = collect(neighbourhoodsResult, "neighbourhoods");
  const attractionSummaries = collect(attractionsResult, "attractions");
  const museums = collect(museumsResult, "museums");
  const restaurants = collect(restaurantsResult, "restaurants");
  const nightlife = collect(nightlifeResult, "nightlife");

  const detailResults = await Promise.allSettled(
    attractionSummaries
      .slice(0, 5)
      .map((attraction) => getPlaceDetails(attraction.id, ctx.languageCode)),
  );
  placesCalls += attractionSummaries.slice(0, 5).length;

  const topAttractions = detailResults
    .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    .filter((value): value is PlaceDetails => value !== null);

  return {
    resolved,
    neighbourhoods,
    topAttractions,
    museums,
    restaurants,
    nightlife,
    placesCalls,
    errors,
  };
}
