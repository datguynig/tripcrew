import assert from "node:assert/strict";
import test from "node:test";
import { BasicDraftSchema, EnrichedDraftSchema } from "@/lib/ai/schema";

test("BasicDraftSchema accepts a valid basic draft", () => {
  const parsed = BasicDraftSchema.parse({
    tier: "basic",
    destination: "Lisbon",
    summary: "A compact group trip with good food and easy walking.",
    themes: ["food", "views", "late nights"],
    generalTips: ["Book dinners early", "Keep one morning flexible"],
    upgradePrompt: "Upgrade for a venue-backed itinerary.",
    generatedAt: new Date().toISOString(),
  });

  assert.equal(parsed.tier, "basic");
});

test("EnrichedDraftSchema rejects malformed activity URLs", () => {
  assert.throws(() =>
    EnrichedDraftSchema.parse({
      tier: "enriched",
      destination: "Lisbon",
      summary: "A practical long weekend plan.",
      weather: null,
      whereToStay: [],
      itinerary: [
        {
          dayNumber: 1,
          date: "2026-06-01",
          theme: "Arrival",
          blocks: [
            {
              period: "morning",
              title: "Settle in",
              activities: [
                {
                  name: "Walk",
                  description: "Keep the first block light.",
                  bookAhead: false,
                  googleMapsUrl: "not-a-url",
                },
              ],
            },
          ],
        },
      ],
      bookAhead: [],
      budget: {
        perPersonGBP: {
          flightsLow: 100,
          flightsHigh: 220,
          accommodationLow: 180,
          accommodationHigh: 320,
          foodLow: 120,
          foodHigh: 220,
          activitiesLow: 80,
          activitiesHigh: 180,
        },
        caveats: ["Prices are estimates."],
      },
      flightSearchUrl: "https://www.skyscanner.net/",
      generatedAt: new Date().toISOString(),
    }),
  );
});
