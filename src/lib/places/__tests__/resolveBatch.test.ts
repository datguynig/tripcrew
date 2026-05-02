import test from "node:test";
import assert from "node:assert/strict";
import { resolvePlaceNames, type PlaceSearchFn } from "@/lib/places/resolveBatch";

const STOCKHOLM = { lat: 59.3293, lng: 18.0686 };

test("resolvePlaceNames dedupes case-insensitive duplicates", async () => {
  const calls: string[] = [];
  const search: PlaceSearchFn = async (query) => {
    calls.push(query);
    return [
      {
        id: "place_" + query.toLowerCase().replace(/\s+/g, "_"),
        location: { latitude: STOCKHOLM.lat, longitude: STOCKHOLM.lng },
        googleMapsUri: `https://www.google.com/maps/place/?q=place_id:place_${query}`,
        websiteUri: null,
      },
    ];
  };

  const result = await resolvePlaceNames(
    ["Vasa Museum", "vasa museum", "Fotografiska"],
    STOCKHOLM,
    25_000,
    { searchText: search, maxLookups: 25 },
  );

  assert.equal(calls.length, 2, "deduped to 2 unique queries");
  assert.ok(result.get("Vasa Museum"));
  assert.ok(result.get("Fotografiska"));
});

test("resolvePlaceNames drops results outside radius", async () => {
  const search: PlaceSearchFn = async () => [
    {
      id: "wrong_place",
      // Cambridge MA, ~5500km from Stockholm
      location: { latitude: 42.3736, longitude: -71.1097 },
      googleMapsUri: "https://www.google.com/maps/...",
      websiteUri: null,
    },
  ];

  const result = await resolvePlaceNames(
    ["Cambridge"],
    STOCKHOLM,
    50_000,
    { searchText: search, maxLookups: 25 },
  );

  assert.equal(result.size, 0, "out-of-radius result dropped");
});

test("resolvePlaceNames respects maxLookups cap", async () => {
  let callCount = 0;
  const search: PlaceSearchFn = async (q) => {
    callCount++;
    return [{ id: q, location: { latitude: STOCKHOLM.lat, longitude: STOCKHOLM.lng }, googleMapsUri: "", websiteUri: null }];
  };

  const names = Array.from({ length: 30 }, (_, i) => `Place${i}`);
  await resolvePlaceNames(names, STOCKHOLM, 25_000, { searchText: search, maxLookups: 5 });

  assert.equal(callCount, 5, "cap enforced");
});

test("resolvePlaceNames rejects names that fail validation", async () => {
  const search: PlaceSearchFn = async () => [];
  const result = await resolvePlaceNames(
    ["", "   ", "x", "a".repeat(81), "Valid Name"],
    STOCKHOLM,
    25_000,
    { searchText: search, maxLookups: 25 },
  );
  assert.equal(result.size, 0, "no valid resolutions for invalid inputs");
});

test("resolvePlaceNames nulls non-https website URLs", async () => {
  const search: PlaceSearchFn = async () => [
    {
      id: "p1",
      location: { latitude: STOCKHOLM.lat, longitude: STOCKHOLM.lng },
      googleMapsUri: "https://www.google.com/maps/x",
      websiteUri: "javascript:alert(1)",
    },
  ];
  const result = await resolvePlaceNames(["Vasa"], STOCKHOLM, 25_000, { searchText: search, maxLookups: 25 });
  const r = result.get("Vasa");
  assert.ok(r);
  assert.equal(r?.website_url, null);
  assert.equal(r?.maps_url, "https://www.google.com/maps/x");
});
