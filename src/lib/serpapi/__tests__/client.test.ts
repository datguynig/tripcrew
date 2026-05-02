import test from "node:test";
import assert from "node:assert/strict";
import { parseHotelResponse, parseFlightOptions } from "@/lib/serpapi/client";

test("parseHotelResponse takes top results sorted by rating then price asc", () => {
  const fixture = {
    properties: [
      {
        name: "Hotel At Six",
        place_id: "ChIJAtSix",
        total_rate: { extracted_lowest: 725, extracted_currency: "GBP" },
        rate_per_night: { extracted_lowest: 145, extracted_currency: "GBP" },
        overall_rating: 4.5,
        images: [{ original_image: "https://example.com/img2.jpg" }],
        link: "https://www.booking.com/hotel/atsix",
      },
      {
        name: "Hotel Diplomat",
        place_id: "ChIJDiplomat",
        total_rate: { extracted_lowest: 600, extracted_currency: "GBP" },
        rate_per_night: { extracted_lowest: 120, extracted_currency: "GBP" },
        overall_rating: 4.7,
        images: [{ original_image: "https://example.com/img.jpg" }],
        link: "https://www.booking.com/hotel/diplomat",
      },
    ],
  };
  const quotes = parseHotelResponse(fixture, "GBP");
  assert.equal(quotes.length, 2);
  assert.equal(quotes[0].name, "Hotel Diplomat");
  assert.equal(quotes[0].price_per_night.amount, 120);
  assert.equal(quotes[0].total_price.amount, 600);
  assert.equal(quotes[0].place_id, "ChIJDiplomat");
});

test("parseHotelResponse drops entries without prices", () => {
  const fixture = {
    properties: [
      { name: "No Price Hotel", place_id: "ChIJNo", overall_rating: 5.0, images: [], link: "https://x" },
    ],
  };
  const quotes = parseHotelResponse(fixture, "GBP");
  assert.equal(quotes.length, 0);
});

test("parseHotelResponse caps at 3 entries", () => {
  const fixture = {
    properties: Array.from({ length: 7 }, (_, i) => ({
      name: `Hotel ${i}`,
      place_id: `ChIJ${i}`,
      total_rate: { extracted_lowest: 100 + i },
      rate_per_night: { extracted_lowest: 20 + i },
      overall_rating: 4 + (i / 10),
      images: [],
      link: "https://x",
    })),
  };
  const quotes = parseHotelResponse(fixture, "GBP");
  assert.equal(quotes.length, 3);
});

test("parseHotelResponse handles empty / malformed input", () => {
  assert.equal(parseHotelResponse({}, "GBP").length, 0);
  assert.equal(parseHotelResponse({ properties: [] }, "GBP").length, 0);
  assert.equal(parseHotelResponse(null, "GBP").length, 0);
  assert.equal(parseHotelResponse("not an object", "GBP").length, 0);
});

const FLIGHT_FIXTURE = {
  best_flights: [
    {
      price: 242,
      flights: [
        {
          airline: "British Airways",
          airline_logo: "https://example.com/ba.png",
          duration: 405,
          departure_airport: { time: "2026-08-12 09:25" },
          arrival_airport: { time: "2026-08-12 12:10" },
        },
      ],
      booking_token: "tok_BA",
    },
    {
      price: 268,
      flights: [
        {
          airline: "SAS",
          airline_logo: "https://example.com/sas.png",
          duration: 390,
          departure_airport: { time: "2026-08-12 12:10" },
          arrival_airport: { time: "2026-08-12 14:40" },
        },
      ],
      booking_token: "tok_SAS",
    },
  ],
  other_flights: [
    {
      price: 312,
      flights: [
        {
          airline: "British Airways",
          airline_logo: "https://example.com/ba.png",
          duration: 550,
          departure_airport: { time: "2026-08-12 06:00" },
          arrival_airport: { time: "2026-08-12 16:30" },
          layovers: [{}],
        },
      ],
      booking_token: "tok_BA2",
    },
  ],
};

test("parseFlightOptions returns top 3 ascending by price", () => {
  const opts = parseFlightOptions(FLIGHT_FIXTURE, "GBP");
  assert.equal(opts.length, 3);
  assert.equal(opts[0].price.amount, 242);
  assert.equal(opts[1].price.amount, 268);
  assert.equal(opts[2].price.amount, 312);
  assert.equal(opts[2].stops, 1);
  assert.equal(opts[0].airline, "British Airways");
});

test("parseFlightOptions handles malformed input safely", () => {
  assert.equal(parseFlightOptions(null, "GBP").length, 0);
  assert.equal(parseFlightOptions({}, "GBP").length, 0);
  assert.equal(parseFlightOptions({ best_flights: [] }, "GBP").length, 0);
});

test("parseFlightOptions drops options without a price", () => {
  const fixture = {
    best_flights: [{ flights: [{ airline: "X" }] }, { price: 0, flights: [{ airline: "Y" }] }],
    other_flights: [],
  };
  assert.equal(parseFlightOptions(fixture, "GBP").length, 0);
});
