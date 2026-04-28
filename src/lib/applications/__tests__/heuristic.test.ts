import assert from "node:assert/strict";
import test from "node:test";
import { computeProvisionalDecision } from "@/lib/applications/heuristic";

const BASE = {
  trips_per_year: "2-3",
  role: "organiser",
  pain: "plan",
  budget_attitude: "splurge",
  email: "alex@example.com",
} as const;

test("computeProvisionalDecision approves a real applicant who travels", () => {
  assert.equal(computeProvisionalDecision(BASE), "approve");
});

test("computeProvisionalDecision rejects when applicant doesn't travel and uses disposable email", () => {
  const result = computeProvisionalDecision({
    ...BASE,
    trips_per_year: "0",
    email: "burner@mailinator.com",
  });
  assert.equal(result, "reject");
});

test("computeProvisionalDecision still approves on the 4/5 boundary", () => {
  // Drop only the trips_per_year signal — score = 4/5, should still approve.
  const result = computeProvisionalDecision({
    ...BASE,
    trips_per_year: "0",
  });
  assert.equal(result, "approve");
});

test("computeProvisionalDecision rejects when below 4 signals", () => {
  // Drop trips_per_year AND use a disposable inbox — score = 3/5.
  const result = computeProvisionalDecision({
    ...BASE,
    trips_per_year: "0",
    email: "tempo@tempmail.com",
  });
  assert.equal(result, "reject");
});

test("computeProvisionalDecision treats all four disposable domains as spam", () => {
  const domains = [
    "mailinator.com",
    "tempmail.com",
    "10minutemail.com",
    "guerrillamail.com",
  ];
  for (const domain of domains) {
    const result = computeProvisionalDecision({
      ...BASE,
      trips_per_year: "0",
      email: `someone@${domain}`,
    });
    assert.equal(result, "reject", `expected reject for @${domain}`);
  }
});

test("computeProvisionalDecision ignores email casing on the domain check", () => {
  const result = computeProvisionalDecision({
    ...BASE,
    trips_per_year: "0",
    email: "Burner@MAILINATOR.com",
  });
  // 4 valid answer signals, but domain still flagged → 3/5 → reject.
  assert.equal(result, "reject");
});
