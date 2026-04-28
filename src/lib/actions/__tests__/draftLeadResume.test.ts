import assert from "node:assert/strict";
import test from "node:test";
import { validateResumeToken } from "@/lib/actions/draftLeadResume";

// Like the teaser submit-form tests, this file only covers the early-
// return validation gates that fire before cookies() / createServiceClient()
// are touched. tsx --test runs through a CJS shim where node:test's
// mock.module is unavailable, so the cookie + supabase paths are covered
// by Playwright e2e (Task 1.14) instead. The action's contract is small:
//   - empty args → null, no cookie write
//   - row missing for (id, token, slug) → null, no cookie write
//   - row found → cookie set, row returned
// The first branch is verified here; the rest land in e2e.

test("validateResumeToken returns null on empty draftId", async () => {
  const result = await validateResumeToken("", "tok-xyz", "bali");
  assert.equal(result, null);
});

test("validateResumeToken returns null on empty token", async () => {
  const result = await validateResumeToken("draft-abc", "", "bali");
  assert.equal(result, null);
});

test("validateResumeToken returns null on empty slug (mismatch case)", async () => {
  // The mismatched-slug spec is enforced inline by the eq("slug", $) filter.
  // For the unit test we exercise the empty-slug guard which is the only
  // reachable branch without a real Supabase / cookie context.
  const result = await validateResumeToken("draft-abc", "tok-xyz", "");
  assert.equal(result, null);
});

test("readDraftFromCookie is exported", async () => {
  // Smoke check that the symbol exists; calling it requires Next's
  // request context (cookies()) and a live Supabase, both of which are
  // exercised by Playwright e2e in Task 1.14.
  const mod = await import("@/lib/actions/draftLeadResume");
  assert.equal(typeof mod.readDraftFromCookie, "function");
});
