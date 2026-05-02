import test from "node:test";
import assert from "node:assert/strict";
import { parseFrankfurterResponse, isSupportedCurrency } from "@/lib/fx/frankfurter";

test("parseFrankfurterResponse extracts the requested rate and date", () => {
  const raw = {
    amount: 100,
    base: "EUR",
    date: "2026-05-02",
    rates: { GBP: 84.7 },
  };
  const result = parseFrankfurterResponse(raw, "EUR", "GBP");
  assert.equal(result?.rate, 0.847);
  assert.equal(result?.rate_date, "2026-05-02");
});

test("parseFrankfurterResponse returns null when target currency missing", () => {
  const raw = { amount: 100, base: "EUR", date: "2026-05-02", rates: { USD: 110 } };
  assert.equal(parseFrankfurterResponse(raw, "EUR", "GBP"), null);
});

test("parseFrankfurterResponse returns null on malformed input", () => {
  assert.equal(parseFrankfurterResponse(null, "EUR", "GBP"), null);
  assert.equal(parseFrankfurterResponse({ rates: "not an object" }, "EUR", "GBP"), null);
});

test("isSupportedCurrency lists ISO codes Frankfurter supports", () => {
  assert.equal(isSupportedCurrency("EUR"), true);
  assert.equal(isSupportedCurrency("GBP"), true);
  assert.equal(isSupportedCurrency("USD"), true);
  assert.equal(isSupportedCurrency("XYZ"), false);
  assert.equal(isSupportedCurrency("BTC"), false);
});
