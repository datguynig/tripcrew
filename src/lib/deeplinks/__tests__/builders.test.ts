import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBookingUrl,
  buildGoogleFlightsUrl,
  buildViatorUrl,
} from "@/lib/deeplinks/builders";

test("buildBookingUrl includes core hotel search params", () => {
  const url = new URL(
    buildBookingUrl({
      destination: "Lisbon",
      checkIn: "2026-06-01",
      checkOut: "2026-06-04",
      adults: 5,
    }),
  );

  assert.equal(url.hostname, "www.booking.com");
  assert.equal(url.searchParams.get("ss"), "Lisbon");
  assert.equal(url.searchParams.get("group_adults"), "5");
  assert.equal(url.searchParams.get("no_rooms"), "3");
});

test("buildGoogleFlightsUrl builds a free-text Google Flights URL", () => {
  const url = buildGoogleFlightsUrl({
    origin: "London",
    destination: "Lisbon",
    departDate: "2026-06-01",
    returnDate: "2026-06-04",
    adults: 5,
  });

  assert.match(url, /^https:\/\/www\.google\.com\/travel\/flights\?q=/);
  const q = decodeURIComponent(new URL(url).searchParams.get("q") ?? "");
  assert.match(q, /from London/);
  assert.match(q, /to Lisbon/);
  assert.match(q, /on 2026-06-01/);
  assert.match(q, /returning 2026-06-04/);
  assert.match(q, /5 adults/);
});

test("buildViatorUrl includes destination search term", () => {
  const url = new URL(buildViatorUrl("New York"));

  assert.equal(url.hostname, "www.viator.com");
  assert.equal(url.searchParams.get("searchTerm"), "New York");
});
