import assert from "node:assert/strict";
import test from "node:test";
import { makeCacheKey } from "@/lib/places/cache";

test("makeCacheKey is deterministic regardless of param order", () => {
  const a = makeCacheKey("text", {
    query: "Lisbon",
    maxResults: 5,
    languageCode: "en",
  });
  const b = makeCacheKey("text", {
    languageCode: "en",
    maxResults: 5,
    query: "Lisbon",
  });

  assert.equal(a, b);
});

test("makeCacheKey ignores null and undefined values", () => {
  const a = makeCacheKey("nearby", {
    latitude: 38.72,
    longitude: -9.13,
    radius: undefined,
  });
  const b = makeCacheKey("nearby", {
    latitude: 38.72,
    longitude: -9.13,
    radius: null,
  });

  assert.equal(a, b);
});
