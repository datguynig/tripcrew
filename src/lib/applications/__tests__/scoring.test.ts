import assert from "node:assert/strict";
import test from "node:test";
import { scoreApplication, MAX_SCORE } from "@/lib/applications/scoring";

test("scoreApplication returns max score for the highest-WTP segment", () => {
  const result = scoreApplication({
    trips_per_year: "4+",
    role: "organiser",
    budget_attitude: "monopoly",
  });
  assert.equal(result, 10);
});

test("scoreApplication scales output to a 0-10 range", () => {
  const result = scoreApplication({
    trips_per_year: "0",
    role: "attendee",
    budget_attitude: "count",
  });
  assert.ok(result >= 0);
  assert.ok(result < 10);
});

test("scoreApplication ranks an active organiser above an occasional attendee at the same budget", () => {
  const organiser = scoreApplication({
    trips_per_year: "2-3",
    role: "organiser",
    budget_attitude: "splurge",
  });
  const attendee = scoreApplication({
    trips_per_year: "1",
    role: "attendee",
    budget_attitude: "splurge",
  });
  assert.ok(organiser > attendee);
});

test("scoreApplication rounds to one decimal place", () => {
  const result = scoreApplication({
    trips_per_year: "2-3",
    role: "depends",
    budget_attitude: "splurge",
  });
  assert.match(result.toString(), /^\d(\.\d)?$/);
});

test("MAX_SCORE is 10 — exposed for callers that scale the bar visualisation", () => {
  assert.equal(MAX_SCORE, 10);
});
