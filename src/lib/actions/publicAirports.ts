"use server";

import { searchPublicAirports } from "@/lib/airports/publicSearch";
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

export async function searchPublicAirportsAction(input: {
  query: string;
}): Promise<{ results?: AirportOption[]; error?: string }> {
  return searchPublicAirports(input);
}
