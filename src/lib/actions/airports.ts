"use server";

import { z } from "zod";
import { searchAirports } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";
import { metrosMatching, type AirportMetro } from "@/lib/airportMetros";

/**
 * Lightweight airport-autocomplete action called by the AI preferences
 * modal. Gated to authenticated users only (prevents drive-by use of
 * the Places key). No rate limiting for now — Places cost per Text
 * Search is low and the modal sees limited traffic.
 *
 * Metro rows (synthetic, curated via airportMetros.ts) are merged at
 * the top so "London" surfaces "London — all airports (LHR · LGW …)"
 * as the first option. Picking a metro lets the AI draft use an IATA
 * metro code ("LON → ARN") instead of committing to a single airport.
 */

const schema = z.object({
  query: z.string().trim().min(1).max(80),
});

export type AirportOption = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  metro?: string | null;
  metroAirports?: string[] | null;
};

function metroToOption(m: AirportMetro): AirportOption {
  return {
    id: `metro:${m.iata}`,
    name: `${m.name} — all airports`,
    address: m.airports.map((a) => a.iata).join(" · "),
    latitude: m.latitude,
    longitude: m.longitude,
    metro: m.iata,
    metroAirports: m.airports.map((a) => a.iata),
  };
}

export async function searchAirportsAction(input: {
  query: string;
}): Promise<{ results?: AirportOption[]; error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { results: [] };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

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
