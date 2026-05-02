import test from "node:test";
import assert from "node:assert/strict";
import { parseHotelResponse } from "@/lib/serpapi/client";

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
