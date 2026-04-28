"use server";

import { z } from "zod";
import { searchAirports } from "@/lib/places";
import { metrosMatching, type AirportMetro } from "@/lib/airportMetros";
import type { AirportOption } from "@/lib/actions/airports";

/**
 * Public airport-autocomplete action for the curated-trip teaser form.
 * Mirrors `searchAirportsAction` but skips the auth gate — this surface
 * is consumed by anonymous marketing visitors, where requiring sign-in
 * would defeat the funnel. Cost remains low: each Places `searchText`
 * call is fractions of a cent and the form lives behind a 2-draft
 * lifetime cap per IP.
 *
 * Metro rows ("London — all airports") are merged at the top so the
 * common case (someone typing their city, not their airport) lands
 * on a sensible suggestion.
 */

const schema = z.object({
  query: z.string().trim().min(1).max(80),
});

function metroToOption(m: AirportMetro): AirportOption {
  return {
    id: `metro:${m.iata}`,
    name: `${m.name} · all airports`,
    address: m.airports.map((a) => a.iata).join(" · "),
    latitude: m.latitude,
    longitude: m.longitude,
    metro: m.iata,
    metroAirports: m.airports.map((a) => a.iata),
  };
}

export async function searchPublicAirportsAction(input: {
  query: string;
}): Promise<{ results?: AirportOption[]; error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { results: [] };

  const metros = metrosMatching(parsed.data.query).slice(0, 2).map(metroToOption);
  const hits = await searchAirports(parsed.data.query, { maxResults: 6 });
  const placeResults: AirportOption[] = hits.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  return { results: [...metros, ...placeResults].slice(0, 8) };
}
