"use server";

import { z } from "zod";
import { searchAirports } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";

/**
 * Lightweight airport-autocomplete action called by the AI preferences
 * modal. Gated to authenticated users only (prevents drive-by use of
 * the Places key). No rate limiting for now — Places cost per Text
 * Search is low and the modal sees limited traffic.
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
};

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

  const hits = await searchAirports(parsed.data.query, { maxResults: 6 });
  return {
    results: hits.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      latitude: p.latitude,
      longitude: p.longitude,
    })),
  };
}
