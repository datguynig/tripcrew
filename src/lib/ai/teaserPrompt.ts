import type { CuratedTrip } from "@/lib/marketing/curatedTrips";
import type { TeaserInputs } from "@/lib/types";

const CREW_LABEL: Record<TeaserInputs["crew"], string> = {
  "2": "two of you",
  "3-4": "three or four of you",
  "5-6": "five or six of you",
  "7+": "seven plus",
};

const DURATION_HINT: Record<TeaserInputs["when"], string> = {
  weekend: "a 3-day weekend",
  week: "a 7-day week",
  "two-weeks": "a 14-day stretch",
  flexible: "a 7-day window (default to a week if no clear preference)",
};

const BUDGET_HINT: Record<TeaserInputs["budget"], string> = {
  "500": "around £500 per head",
  "1000": "around £1,000 per head",
  "1500": "around £1,500 per head",
  "2000+": "£2,000+ per head",
};

export function buildTeaserPrompt(trip: CuratedTrip, inputs: TeaserInputs): string {
  return `You are drafting a personalised teaser of the ${trip.city} curated trip for a Tripcrew applicant.

THEIR INPUTS:
- Origin airport: ${inputs.origin}
- Crew size: ${CREW_LABEL[inputs.crew]}
- When: ${DURATION_HINT[inputs.when]}
- Budget: ${BUDGET_HINT[inputs.budget]}

CURATED TRIP CONTEXT (the canonical full plan you're scaling from):
- Destination: ${trip.city}, ${trip.country}
- Tagline: ${trip.tagline}
- Vibes: ${trip.vibesLabel}
- Typical crew: ${trip.crewLabel}
- Typical dates window: ${trip.datesLabel}
- Typical per-head: £${trip.perHeadAmount.toLocaleString("en-GB")}
- Total days in canonical plan: ${trip.totalDays}
- Day-by-day plan (do NOT include specific restaurants/hotels/activity providers from this in your output — vibe only):
${trip.fullSchedule.map((row) => `  · ${row.day} — ${row.place}: ${row.note}`).join("\n")}
- Typical flight quotes (used for price band only):
${trip.flights.map((f) => `  · ${f.carrier} ${f.route} ${f.pricePerHead}`).join("\n")}
- Typical stay options (used for neighbourhood and price band only):
${trip.stays.map((s) => `  · ${s.name} in ${s.neighbourhood}, ${s.pricePerNight}/night`).join("\n")}
- Bookings count (the number of distinct items to lock): ${trip.bookings.length}

CALIBRATION RULES (CRITICAL):
- Pick exactly TWO days from the curated plan: day 1 (arrival) and one middle day.
- Day descriptions: vibe-only ("morning surf, slow lunch, sunset cliff jump"). NEVER name specific restaurants, hotels, or activity providers.
- Stay output: neighbourhood + price band ONLY. NEVER name a specific stay.
- Flights output: price band only ("from ~£XXXpp"). NEVER name a carrier or schedule.
- Bookings output: count only.
- Hero paragraph: ONE paragraph, 40-280 chars, mentions their crew size, their origin airport, plausible specific dates within the trip's season, and their budget per head.
- Specific dates: pick a plausible window inside the trip's typical dates (${trip.datesLabel}). Match their "when" duration. Use British date format ("14–20 June").
- Weather: one line about the season at those dates.
- Output STRICTLY this JSON shape:

{
  "spec": { "perHead": "£X,XXX", "crew": "<their crew>", "origin": "${inputs.origin}", "vibes": "<trip vibes>" },
  "hero_paragraph": "<one paragraph>",
  "days": [
    { "day": "Day 1", "place": "<place name>", "note": "<vibe-only description>" },
    { "day": "Day N", "place": "<place name>", "note": "<vibe-only description>" }
  ],
  "stay": { "neighbourhood": "<area name>", "priceBand": "~£XXX / night" },
  "flights": { "priceBand": "${inputs.origin}→<dest IATA> from ~£XXXpp" },
  "bookings_count": <integer>,
  "weather": "<one-line seasonal note>"
}

Return ONLY the JSON. No prose, no markdown, no preamble.`;
}
