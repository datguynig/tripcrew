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

test("computeProvisionalDecision rejects when applicant doesn't travel even with a real inbox", () => {
  const result = computeProvisionalDecision({
    ...BASE,
    trips_per_year: "0",
  });
  assert.equal(result, "reject");
});

test("computeProvisionalDecision rejects when inbox is disposable even with travel signal", () => {
  const result = computeProvisionalDecision({
    ...BASE,
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
  // Valid answer signals + travels, but inbox is disposable → reject.
  assert.equal(result, "reject");
});
