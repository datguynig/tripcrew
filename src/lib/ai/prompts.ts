import type { EnrichedDestination } from "@/lib/places/orchestrator";
import type { WeatherForecast } from "@/lib/weather/client";
import { buildBookingUrl } from "@/lib/deeplinks/builders";
import {
  OCCASION_LABELS,
  VIBE_LABELS,
  type AiOccasion,
  type AiVibeTag,
  type TripPin,
} from "@/lib/types";

export interface TripContext {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  crewSize: number;
  currency?: string;
  budgetPerPersonGBP?: number;
  budgetTier?: "tight" | "mid" | "lavish" | "custom";
  origin?: string;
  notes?: string;
  vibes?: AiVibeTag[];
  occasion?: AiOccasion;
  pins?: TripPin[];
}

function tripDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

function vibeLabels(vibes: AiVibeTag[] | undefined): string {
  if (!vibes || vibes.length === 0) return "";
  return vibes.map((v) => VIBE_LABELS[v]).join(", ");
}

function pinsBlock(pins: TripPin[] | undefined): string {
  if (!pins || pins.length === 0) return "";
  const lines = pins.map((pin, i) => {
    const parts: string[] = [];
    parts.push(`${i + 1}. "${pin.title}"`);
    parts.push(`priority=${pin.priority}`);
    if (pin.when) parts.push(`when="${pin.when}"`);
    if (pin.date) parts.push(`date=${pin.date}`);
    if (pin.notes) parts.push(`notes="${pin.notes}"`);
    return `   ${parts.join(" | ")}`;
  });
  return [
    "",
    "PINNED MOMENTS",
    "These are concrete moments the crew has decided in advance. Treat them as fixed anchors:",
    ...lines,
    "Build the schedule and itinerary around these. The day or slot containing each pin must headline that moment in its `body` and have its `heading` reflect it. Don't compete with a pin within the same slot — surrounding activities should warm up to it (food before, wind-down after). For `must` priority items, also include practical setup notes (booking, travel, gear) in the matching schedule body.",
    "",
  ].join("\n");
}

export function buildEnrichedDraftPrompt(
  ctx: TripContext,
  enriched: EnrichedDestination,
  weather: WeatherForecast | null,
  flightSearchUrl: string,
): string {
  const days = tripDays(ctx.startDate, ctx.endDate);
  const hotelSearchUrl = buildBookingUrl({
    destination: ctx.destination,
    checkIn: ctx.startDate,
    checkOut: ctx.endDate,
    adults: ctx.crewSize,
  });

  const placesContext = JSON.stringify(
    {
      destination: enriched.resolved?.name,
      coords: enriched.resolved?.location,
      neighbourhoods: enriched.neighbourhoods.slice(0, 5).map((item) => ({
        name: item.name,
        summary: item.editorialSummary,
        address: item.shortFormattedAddress,
      })),
      topAttractions: enriched.topAttractions.map((item) => ({
        placeId: item.id,
        name: item.name,
        rating: item.rating,
        summary: item.editorialSummary,
        website: item.websiteUri,
        googleMapsUri: item.googleMapsUri,
        address: item.shortFormattedAddress,
        openingHours: item.regularOpeningHours?.weekdayDescriptions,
      })),
      museums: enriched.museums.map((item) => ({
        placeId: item.id,
        name: item.name,
        rating: item.rating,
      })),
      restaurants: enriched.restaurants.slice(0, 8).map((item) => ({
        placeId: item.id,
        name: item.name,
        rating: item.rating,
        priceLevel: item.priceLevel,
      })),
      nightlife: enriched.nightlife.map((item) => ({
        placeId: item.id,
        name: item.name,
        rating: item.rating,
      })),
    },
    null,
    2,
  );

  const vibes = vibeLabels(ctx.vibes);
  const occasion = ctx.occasion ? OCCASION_LABELS[ctx.occasion] : "";
  const pins = pinsBlock(ctx.pins);
  const currency = ctx.currency ?? "GBP";

  return `You are a thoughtful travel planner generating an itinerary for a group trip. The crew has already locked in their destination and dates. Produce a structured, useful, honest draft.

TRIP CONTEXT
- Destination: ${ctx.destination}
- Dates: ${ctx.startDate} to ${ctx.endDate} (${days} day${days === 1 ? "" : "s"})
- Crew size: ${ctx.crewSize} people
${ctx.origin ? `- Travelling from: ${ctx.origin}\n` : ""}${ctx.budgetPerPersonGBP ? `- Approximate budget per person: ${currency} ${ctx.budgetPerPersonGBP}${ctx.budgetTier ? ` (tier: ${ctx.budgetTier})` : ""}\n` : ""}${occasion ? `- Occasion: ${occasion}\n` : ""}${vibes ? `- Vibes: ${vibes}\n` : ""}${ctx.notes ? `- Crew notes: ${ctx.notes}\n` : ""}${pins}
WEATHER FORECAST FOR THESE DATES
${weather ? weather.description : "Forecast not available for these dates."}

REAL DESTINATION DATA
Use this data. Do not invent places.
${placesContext}

LINKS
- Flight search URL, use exactly: ${flightSearchUrl}
- Booking search URL, use for every hotel suggestion: ${hotelSearchUrl}

REQUIREMENTS
1. Use only places from REAL DESTINATION DATA. Do not invent attractions, restaurants, or hotels.
2. When referencing a place from the data, include its placeId in the activity object.
3. Hotel suggestions must use the provided Booking.com search URL, not invented hotel names.
4. For budget ranges, give honest ${currency} per-person ranges. Include caveats that prices are estimates and change.
5. Itinerary must have exactly ${days} day(s), each with morning, afternoon, and evening blocks where reasonable.
6. The bookAhead array should contain 2 to 5 activities likely to require advance booking.
7. Keep tone warm and practical. Avoid superlatives like stunning, breathtaking, and must-see. Tone-shape from the vibes and occasion above: e.g. nightlife/party means at least one proper night out, foodie means specific named restaurants, chill means relaxed pace, family means kid-friendly and sensible bedtimes, honeymoon means romantic and intimate.
8. Do not use em dash characters anywhere in the output. Use commas, colons, or separate sentences.
9. Output valid JSON only. Do not wrap in markdown code fences.

SETUP REQUIREMENTS
Alongside the itinerary above, you also produce a "setup" object. This is the trip's at-a-glance brief: editorial hero copy, a 4-cell spec grid, a day-by-day schedule, an activity shortlist, and a list of bookings the crew should action. Rules:
- "heroTitle": one or two words, the city or trip name, ≤ 80 chars.
- "heroSubtitle": one editorial paragraph, ≤ 300 chars, no superlatives.
- "cityLabel": e.g. "Lisbon, Portugal" — destination + country.
- "datesLabel": short human range, e.g. "06 – 12 SEP" or "SEP 6 – 12".
- "specGrid": exactly 4 cells. Suggested labels: "Per head" (with amount in ${currency}), "Crew", "When", "From" (origin/route). For the monetary cell set "amount" to the numeric per-person figure in ${currency}.
- "schedule": one row per day (${days} row${days === 1 ? "" : "s"}, max 10). day_label is short ("Day 1 — Sat", "Sat 06 Sep"); heading is a short title for the day; body is 1-2 sentences describing what the crew does that day.
- "activities": 6-20 entries, mix of day + night, drawn from the same REAL DESTINATION DATA above. "meta" is a short helper line (area, time, or price hint).
- "bookings": 3-12 actionable items the crew should book or arrange in advance.
${pins ? "- The schedule rows must respect the pinned moments above: each pin appears in exactly the day/slot it specifies, headlined in that row's heading and body. The bookings list must include any practical reservations the pinned moments imply.\n" : ""}

OUTPUT SCHEMA
{
  "tier": "enriched",
  "destination": "string",
  "summary": "2-3 sentence overview",
  "weather": { "description": "string", "averageHighC": number, "averageLowC": number } | null,
  "whereToStay": [
    {
      "neighbourhood": "string",
      "description": "2-3 sentences",
      "bestFor": "string",
      "hotelSuggestions": [
        { "area": "string", "description": "string", "searchUrl": "Booking.com URL" }
      ]
    }
  ],
  "itinerary": [
    {
      "dayNumber": number,
      "date": "YYYY-MM-DD",
      "theme": "string",
      "blocks": [
        {
          "period": "morning" | "afternoon" | "evening",
          "title": "string",
          "activities": [
            {
              "placeId": "string from data, optional",
              "name": "string",
              "description": "string",
              "approxDurationMinutes": number,
              "bookAhead": boolean,
              "googleMapsUrl": "string, optional"
            }
          ],
          "notes": "string, optional"
        }
      ]
    }
  ],
  "bookAhead": [],
  "budget": {
    "perPersonGBP": {
      "flightsLow": number, "flightsHigh": number,
      "accommodationLow": number, "accommodationHigh": number,
      "foodLow": number, "foodHigh": number,
      "activitiesLow": number, "activitiesHigh": number
    },
    "caveats": ["string"]
  },
  "flightSearchUrl": "${flightSearchUrl}",
  "setup": {
    "heroTitle": "string",
    "heroSubtitle": "string",
    "cityLabel": "string",
    "datesLabel": "string",
    "specGrid": [ { "label": "string", "value": "string", "sub": "string", "amount": number | null }, ... × 4 ],
    "schedule": [ { "day_label": "string", "heading": "string", "body": "string" }, ... ],
    "activities": [ { "title": "string", "meta": "string", "category": "day" | "night" }, ... ],
    "bookings": [ { "title": "string" }, ... ]
  },
  "generatedAt": "ISO timestamp"
}`;
}

export function buildBasicDraftPrompt(ctx: TripContext): string {
  const vibes = vibeLabels(ctx.vibes);
  const occasion = ctx.occasion ? OCCASION_LABELS[ctx.occasion] : "";
  const prefsLines: string[] = [];
  if (occasion) prefsLines.push(`- Occasion: ${occasion}`);
  if (vibes) prefsLines.push(`- Vibes: ${vibes}`);
  if (ctx.budgetTier) prefsLines.push(`- Budget tier: ${ctx.budgetTier}`);
  if (ctx.notes) prefsLines.push(`- Crew notes: ${ctx.notes}`);
  const prefsBlock =
    prefsLines.length > 0 ? `\n${prefsLines.join("\n")}` : "";

  return `You are a travel planner generating a free-tier overview for a group trip.

TRIP CONTEXT
- Destination: ${ctx.destination}
- Dates: ${ctx.startDate} to ${ctx.endDate}
- Crew size: ${ctx.crewSize} people${prefsBlock}

Produce a brief, useful overview. Do not invent specific places, restaurants, or hotels. Stay general. The user will see a prompt to upgrade for the full enriched experience.

REQUIREMENTS
1. Keep it short and helpful.
2. Provide 3 to 5 thematic angles for the trip.
3. Provide 3 to 5 general tips relevant to a group trip to this destination.
4. ${prefsLines.length > 0 ? "Tone-shape from the occasion and vibes above (e.g. nightlife = include a night-out angle, foodie = food-led angle, family = kid-friendly angles, honeymoon = romantic and intimate angle). " : ""}Do not use em dash characters. Do not use markdown code fences.
5. Output valid JSON only.

OUTPUT SCHEMA
{
  "tier": "basic",
  "destination": "string",
  "summary": "2-3 sentence overview",
  "themes": ["string"],
  "generalTips": ["string"],
  "upgradePrompt": "1 sentence inviting them to upgrade for the full enriched draft",
  "generatedAt": "ISO timestamp"
}`;
}
