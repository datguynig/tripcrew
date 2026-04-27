import type { AiVibeTag } from "@/lib/types";

/**
 * Single source of truth for what each vibe tag *means* to the AI.
 *
 * - `prompt` — a concrete, actionable instruction projected into the
 *   PREFERENCES block of the trip-planning prompt. One imperative sentence
 *   per tag so the model has no room to interpret the label freely.
 * - `placesQueries` — extra Places API fetches added to the destination
 *   enrichment when this tag is selected. Results land in the prompt under
 *   REAL DESTINATION DATA › vibePlaces so the model can ground its
 *   suggestions in real spots, not invent them.
 *
 * Each query has a stable `key`. Adjacent tags (e.g. `bars` + `live_music`)
 * may share keys; the orchestrator dedupes by key so picking both doesn't
 * cost double the calls.
 */

export type VibePlacesQuery =
  | {
      kind: "nearby";
      key: string;
      includedTypes: string[];
      radius: number;
      max: number;
    }
  | {
      kind: "text";
      key: string;
      query: (destination: string) => string;
      max: number;
    };

export type VibeInstruction = {
  prompt: string;
  placesQueries?: VibePlacesQuery[];
};

export const VIBE_INSTRUCTIONS: Record<AiVibeTag, VibeInstruction> = {
  // —— Pace ——
  chill: {
    prompt:
      "Keep the schedule light. Build in late mornings, long lunches, and downtime. No more than two scheduled blocks per day.",
  },
  active: {
    prompt:
      "Build walking-heavy days with three or more stops, covering distance between neighbourhoods. Suggest comfortable shoes in bookings.",
  },
  adventure: {
    prompt:
      "Include at least one off-the-beaten-track or physical activity (e.g. kayaking, climbing, paragliding, multi-day hike). Add gear/transport notes to bookings.",
    placesQueries: [
      {
        kind: "text",
        key: "adventure",
        query: (d) => `outdoor adventure activities near ${d}`,
        max: 5,
      },
    ],
  },
  sport: {
    prompt:
      "Include one stadium tour or live match if a fixture lines up with the dates; otherwise schedule one playable sport (5-a-side, padel, surf lesson). Reference specific venues from REAL DESTINATION DATA where possible.",
    placesQueries: [
      {
        kind: "text",
        key: "sport_venues",
        query: (d) => `sports stadium and arenas in ${d}`,
        max: 5,
      },
    ],
  },

  // —— Setting ——
  beach: {
    prompt:
      "Hotel suggestions should favour coastal neighbourhoods. Schedule at least one beach-day block per trip.",
    placesQueries: [
      {
        kind: "text",
        key: "beaches",
        query: (d) => `best beaches near ${d}`,
        max: 5,
      },
    ],
  },
  mountains: {
    prompt:
      "Plan at least one half-day or full-day mountain/hill activity (hike, viewpoint, scenic drive, cable car). Add transport and gear notes to bookings.",
    placesQueries: [
      {
        kind: "text",
        key: "mountains",
        query: (d) => `hiking trails and mountain viewpoints near ${d}`,
        max: 5,
      },
    ],
  },
  nature: {
    prompt:
      "Include at least one nature or wildlife block (national park, botanical garden, wildlife reserve, scenic walk). Quiet, low-density places.",
    placesQueries: [
      {
        kind: "nearby",
        key: "nature",
        includedTypes: ["park", "national_park"],
        radius: 25_000,
        max: 5,
      },
    ],
  },
  city: {
    prompt:
      "Stay in the urban core. Lean into walkable neighbourhoods, cafés, street life. No day-trips out.",
  },

  // —— Food ——
  foodie: {
    prompt:
      "Book named restaurants from REAL DESTINATION DATA: chef's tables, tasting menus, places worth a reservation. List 2+ in bookAhead with reservation notes.",
  },
  street_food: {
    prompt:
      "Lead the food story with markets, food halls, and street stalls, not formal restaurants. Suggest a market visit in the schedule.",
    placesQueries: [
      {
        kind: "text",
        key: "street_food",
        query: (d) => `food market and street food in ${d}`,
        max: 6,
      },
    ],
  },
  wine: {
    prompt:
      "Include at least one vineyard visit or wine-region day-trip if regionally appropriate, and pick a wine bar or wine-led restaurant for one evening. Add tasting/transport to bookings.",
    placesQueries: [
      {
        kind: "text",
        key: "wineries",
        query: (d) => `wineries and vineyards near ${d}`,
        max: 5,
      },
      {
        kind: "nearby",
        key: "wine_bars",
        includedTypes: ["wine_bar"],
        radius: 8_000,
        max: 5,
      },
    ],
  },

  // —— After dark ——
  party: {
    prompt:
      "Schedule one proper night out (a club from REAL DESTINATION DATA, late evening) and let the next morning recover (slow start, no early booking).",
    placesQueries: [
      {
        kind: "nearby",
        key: "clubs",
        includedTypes: ["night_club"],
        radius: 8_000,
        max: 5,
      },
    ],
  },
  bars: {
    prompt:
      "Build evenings around bars (cocktail, wine, dive), not clubs. Pick 2+ named spots from REAL DESTINATION DATA across the trip.",
    placesQueries: [
      {
        kind: "nearby",
        key: "bars",
        includedTypes: ["bar"],
        radius: 8_000,
        max: 8,
      },
    ],
  },
  live_music: {
    prompt:
      "Include at least one live-music evening (gig, jazz club, festival if in season). Reference specific venues from REAL DESTINATION DATA.",
    placesQueries: [
      {
        kind: "text",
        key: "live_music",
        query: (d) => `live music venues and concert halls in ${d}`,
        max: 5,
      },
    ],
  },

  // —— Culture ——
  art: {
    prompt:
      "Dedicate one block to galleries. Pick the highest-rated art_gallery or museum from REAL DESTINATION DATA. Note opening hours.",
    placesQueries: [
      {
        kind: "nearby",
        key: "galleries",
        includedTypes: ["art_gallery"],
        radius: 8_000,
        max: 5,
      },
    ],
  },
  history: {
    prompt:
      "Include 2+ historical sites (ruins, monuments, historic neighbourhoods, history museums). Briefly note the historical context in each block's body.",
    placesQueries: [
      {
        kind: "nearby",
        key: "history",
        includedTypes: ["historical_landmark", "museum"],
        radius: 8_000,
        max: 5,
      },
    ],
  },
  architecture: {
    prompt:
      "Highlight notable buildings (religious, civic, or modernist landmarks). Plan a self-guided architecture walk for one afternoon.",
    placesQueries: [
      {
        kind: "text",
        key: "architecture",
        query: (d) => `notable architecture and famous buildings in ${d}`,
        max: 5,
      },
    ],
  },

  // —— Mood ——
  romantic: {
    prompt:
      "Stay couples-only in tone: intimate restaurants, sunset spots, no big-group venues. Pick a small boutique-style hotel area.",
  },
  family_friendly: {
    prompt:
      "Every block must be kid-OK. Sensible bedtimes, walkable distances, parks/playgrounds in the schedule, casual dining over fine.",
  },
  luxury: {
    prompt:
      "Top-end across the board: 5-star hotel area, the destination's best restaurants from the data, premium experiences (private guides, helicopter, tasting menus). Budget should reflect this.",
  },
  wellness: {
    prompt:
      "Slow daily pace. Build in spa/yoga/retreat blocks. Suggest 1+ wellness booking. Lean clean food, early evenings.",
    placesQueries: [
      {
        kind: "text",
        key: "wellness",
        query: (d) => `spa and yoga studios in ${d}`,
        max: 5,
      },
    ],
  },
  photogenic: {
    prompt:
      "Call out 2-3 named viewpoints/golden-hour spots in the schedule. Recommend specific times of day for each.",
  },
};

/**
 * Project selected vibes into a structured PREFERENCES block for the prompt.
 * Returns empty string when no vibes selected (caller's tone-shaping
 * defaults apply).
 */
export function vibePromptBlock(vibes: AiVibeTag[] | undefined): string {
  if (!vibes || vibes.length === 0) return "";
  const lines = vibes
    .filter((v): v is AiVibeTag => v in VIBE_INSTRUCTIONS)
    .map((v) => `- ${VIBE_INSTRUCTIONS[v].prompt}`);
  if (lines.length === 0) return "";
  return [
    "VIBE PREFERENCES",
    "Treat each as a binding instruction. The plan is wrong if any is ignored:",
    ...lines,
    "",
  ].join("\n");
}

/**
 * Drop stale tag values that aren't in the current taxonomy. Trips saved
 * before a tag rename/removal may carry orphaned strings on
 * `meta.ai_preferences.vibes`. Use this when reading vibes for any user-
 * facing surface so the form, prompt, and saves all see the same set.
 */
export function sanitizeVibes(
  raw: readonly string[] | null | undefined,
): AiVibeTag[] {
  if (!raw) return [];
  return raw.filter((v): v is AiVibeTag => v in VIBE_INSTRUCTIONS);
}

/**
 * Collect deduped Places queries for selected vibes. Multiple tags can
 * share a `key` (e.g. `bars` + `live_music` both want bar data); we keep
 * the first occurrence per key so we don't double-fetch.
 */
export function vibePlacesQueries(
  vibes: AiVibeTag[] | undefined,
): VibePlacesQuery[] {
  if (!vibes || vibes.length === 0) return [];
  const seen = new Set<string>();
  const out: VibePlacesQuery[] = [];
  for (const v of vibes) {
    const inst = VIBE_INSTRUCTIONS[v];
    if (!inst?.placesQueries) continue;
    for (const q of inst.placesQueries) {
      if (seen.has(q.key)) continue;
      seen.add(q.key);
      out.push(q);
    }
  }
  return out;
}
