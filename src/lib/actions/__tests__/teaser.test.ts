import assert from "node:assert/strict";
import test from "node:test";
import { submitTeaserForm } from "@/lib/actions/teaser";

// These tests exercise the validation gates before any Supabase, Gemini,
// or `headers()` call. Validation runs first so the early-return branches
// never reach the server-only dependencies. End-to-end coverage of the
// cache + insert + AI path lives in the Playwright e2e (Task 1.14).

test("submitTeaserForm rejects an invalid email", async () => {
  const result = await submitTeaserForm({
    email: "not-an-email",
    slug: "bali",
    origin: "LHR",
    crew: "3-4",
    when: "week",
    budget: "1000",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /email/i);
});

test("submitTeaserForm rejects a non-IATA origin", async () => {
  const result = await submitTeaserForm({
    email: "user@example.com",
    slug: "bali",
    origin: "London",
    crew: "3-4",
    when: "week",
    budget: "1000",
  });
  assert.equal(result.ok, false);
});

test("submitTeaserForm rejects an unknown trip slug", async () => {
  process.env.IP_HASH_SALT = "test-salt-fixture";
  const result = await submitTeaserForm({
    email: "user@example.com",
    slug: "atlantis",
    origin: "LHR",
    crew: "3-4",
    when: "week",
    budget: "1000",
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "Unknown trip");
});
