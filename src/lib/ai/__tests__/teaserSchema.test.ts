import assert from "node:assert/strict";
import test from "node:test";
import { parseTeaserOutput } from "@/lib/ai/teaserSchema";

const valid = {
  spec: { perHead: "£1,200", crew: "6", origin: "MAN", vibes: "Wellness · Surf" },
  hero_paragraph: "Six of you, leaving MAN on 14 June, around £1,200pp.",
  days: [
    { day: "Day 1", place: "Arrival in Canggu", note: "Land, settle in, sunset dinner near the villa." },
    { day: "Day 4", place: "Mount Batur sunrise", note: "Early start, hot springs after, breakfast back at the villa." },
  ],
  stay: { neighbourhood: "Canggu", priceBand: "~£140 / night" },
  flights: { priceBand: "MAN→DPS from ~£680pp" },
  bookings_count: 12,
  weather: "June: dry season, 28°C average.",
};

test("parseTeaserOutput accepts valid teaser output", () => {
  const result = parseTeaserOutput(valid);
  assert.equal(result.days.length, 2);
  assert.equal(result.spec.perHead, "£1,200");
});

test("parseTeaserOutput rejects fewer than 2 days", () => {
  assert.throws(() => parseTeaserOutput({ ...valid, days: [valid.days[0]] }));
});

test("parseTeaserOutput rejects more than 2 days", () => {
  assert.throws(() =>
    parseTeaserOutput({ ...valid, days: [...valid.days, valid.days[0]] }),
  );
});

test("parseTeaserOutput rejects negative bookings_count", () => {
  assert.throws(() => parseTeaserOutput({ ...valid, bookings_count: -1 }));
});
