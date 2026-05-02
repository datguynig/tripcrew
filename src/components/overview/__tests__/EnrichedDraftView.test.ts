import test from "node:test";
import assert from "node:assert/strict";
import {
  getActivityPlaceLinks,
  getLiveAccommodationForTier,
} from "@/components/overview/EnrichedDraftView";
import type { HotelPricing, ScheduleItemPlace } from "@/lib/types";

const hotels: HotelPricing = {
  provider: "serpapi-google-hotels",
  refreshed_at: "2026-05-02T10:00:00.000Z",
  fetch_error: null,
  quotes: [
    {
      name: "Vila Mare Mateo",
      place_id: "hotel_1",
      rating: 4.6,
      price_per_night: { amount: 93, currency: "GBP" },
      total_price: { amount: 465, currency: "GBP" },
      thumbnail_url: null,
      deeplink: "https://booking.example/hotel_1",
    },
  ],
};

test("getLiveAccommodationForTier hides live hotel totals from Member", () => {
  assert.equal(getLiveAccommodationForTier(hotels, false), null);
});

test("getLiveAccommodationForTier exposes per-person hotel totals to Pioneer", () => {
  const result = getLiveAccommodationForTier(hotels, true);
  assert.ok(result);
  assert.equal(result.low, 232.5);
  assert.equal(result.high, 232.5);
  assert.equal(result.currency, "GBP");
});

test("getActivityPlaceLinks prefers resolved schedule links when available", () => {
  const index = new Map<string, ScheduleItemPlace>([
    [
      "place_123",
      {
        name: "Principotes",
        place_id: "place_123",
        maps_url: "https://maps.example/principotes",
        website_url: "https://principotes.example",
      },
    ],
  ]);

  const result = getActivityPlaceLinks({
    placeId: "place_123",
    name: "Principotes",
    placesIndex: index,
  });

  assert.equal(result.mapsUrl, "https://maps.example/principotes");
  assert.equal(result.websiteUrl, "https://principotes.example");
});

test("getActivityPlaceLinks falls back to Google Maps place_id URL", () => {
  const result = getActivityPlaceLinks({
    placeId: "ChIJaTBR71xrWxMRHslWAq3Qrf8",
    name: "Principotes & Tulum Resto Lounge",
  });

  assert.equal(
    result.mapsUrl,
    "https://www.google.com/maps/search/?api=1&query=Principotes+%26+Tulum+Resto+Lounge&query_place_id=ChIJaTBR71xrWxMRHslWAq3Qrf8",
  );
  assert.equal(result.websiteUrl, null);
});

test("getActivityPlaceLinks can resolve book-ahead items by place name", () => {
  const index = new Map<string, ScheduleItemPlace>([
    [
      "place_456",
      {
        name: "Beach Club",
        place_id: "place_456",
        maps_url: "https://maps.example/beach-club",
        website_url: null,
      },
    ],
  ]);

  const result = getActivityPlaceLinks({
    name: "Beach Club",
    placesIndex: index,
  });

  assert.equal(result.mapsUrl, "https://maps.example/beach-club");
});
