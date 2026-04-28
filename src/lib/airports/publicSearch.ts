import { z } from "zod";
import { metrosMatching, type AirportMetro } from "@/lib/airportMetros";
import { resolveDestinationIata } from "@/lib/iata";
import { searchAirports } from "@/lib/places";
import type { AirportOption } from "@/lib/actions/airports";

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

function titleCase(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function iataFallbackOption(query: string): AirportOption | null {
  const iata = resolveDestinationIata(query);
  if (!iata) return null;
  const label = query.trim().toUpperCase() === iata ? iata : titleCase(query);
  return {
    id: `iata:${iata}`,
    name: `${label} Airport`,
    address: iata,
    latitude: null,
    longitude: null,
    metro: null,
    metroAirports: null,
  };
}

export async function searchPublicAirports(input: {
  query: string;
}): Promise<{ results?: AirportOption[]; error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { results: [] };

  const metros = metrosMatching(parsed.data.query).slice(0, 2).map(metroToOption);
  const fallback = iataFallbackOption(parsed.data.query);
  const hits = await searchAirports(parsed.data.query, { maxResults: 6 });
  const placeResults: AirportOption[] = hits.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    latitude: p.latitude,
    longitude: p.longitude,
  }));

  const results = [
    ...metros,
    ...(fallback &&
    !metros.some((m) => m.metro === fallback.address) &&
    !placeResults.some((p) => p.id === fallback.id)
      ? [fallback]
      : []),
    ...placeResults,
  ];

  return { results: results.slice(0, 8) };
}
