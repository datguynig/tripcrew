import { getPlaceDetails } from "@/lib/places/details";
import { nearbySearch } from "@/lib/places/nearby";
import { textSearch } from "@/lib/places/text-search";
import type { PlaceDetails, PlaceSummary } from "@/lib/places/types";
import type { VibePlacesQuery } from "@/lib/ai/vibeMap";

export interface DestinationContext {
  destination: string;
  languageCode?: string;
  regionCode?: string;
  vibeQueries?: VibePlacesQuery[];
}

export interface EnrichedDestination {
  resolved: PlaceSummary | null;
  neighbourhoods: PlaceSummary[];
  topAttractions: PlaceDetails[];
  museums: PlaceSummary[];
  restaurants: PlaceSummary[];
  nightlife: PlaceSummary[];
  // Keyed by VibePlacesQuery.key — e.g. { wineries: [...], bars: [...] }.
  // Empty when no vibes selected. Promised to the prompt under
  // REAL DESTINATION DATA › vibePlaces so the model can ground vibe-led
  // suggestions in real spots, not invent them.
  vibePlaces: Record<string, PlaceSummary[]>;
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
      vibePlaces: {},
      placesCalls,
      errors: [
        ...errors,
        { source: "destination_resolve", message: "Destination not found" },
      ],
    };
  }

  const { latitude, longitude } = resolved.location;
  const baseFetches: Array<Promise<PlaceSummary[]>> = [
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
  ];

  const vibeQueries = ctx.vibeQueries ?? [];
  const vibeFetches: Array<Promise<PlaceSummary[]>> = vibeQueries.map((q) => {
    if (q.kind === "nearby") {
      return nearbySearch({
        latitude,
        longitude,
        radius: q.radius,
        includedTypes: q.includedTypes,
        maxResults: q.max,
        rankBy: "POPULARITY",
        languageCode: ctx.languageCode,
      });
    }
    return textSearch({
      query: q.query(ctx.destination),
      maxResults: q.max,
      languageCode: ctx.languageCode,
    });
  });

  const allResults = await Promise.allSettled([
    ...baseFetches,
    ...vibeFetches,
  ]);
  placesCalls += baseFetches.length + vibeFetches.length;

  const collect = <T>(result: PromiseSettledResult<T[]>, source: string): T[] => {
    if (result.status === "fulfilled") return result.value;
    errors.push({ source, message: messageFromError(result.reason) });
    return [];
  };

  const [
    neighbourhoodsResult,
    attractionsResult,
    museumsResult,
    restaurantsResult,
    nightlifeResult,
    ...vibeResults
  ] = allResults;

  const neighbourhoods = collect(neighbourhoodsResult, "neighbourhoods");
  const attractionSummaries = collect(attractionsResult, "attractions");
  const museums = collect(museumsResult, "museums");
  const restaurants = collect(restaurantsResult, "restaurants");
  const nightlife = collect(nightlifeResult, "nightlife");

  const vibePlaces: Record<string, PlaceSummary[]> = {};
  vibeQueries.forEach((q, i) => {
    vibePlaces[q.key] = collect(vibeResults[i], `vibe:${q.key}`);
  });

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
    vibePlaces,
    placesCalls,
    errors,
  };
}
