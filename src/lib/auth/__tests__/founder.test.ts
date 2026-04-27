import assert from "node:assert/strict";
import test from "node:test";
import { isFounderProfile } from "@/lib/auth/founder";

test("isFounderProfile returns true when profile.is_founder is true", () => {
  assert.equal(
    isFounderProfile({ id: "u", name: null, is_founder: true }),
    true,
  );
});

test("isFounderProfile returns false when is_founder is missing or false", () => {
  assert.equal(
    isFounderProfile({ id: "u", name: null, is_founder: false }),
    false,
  );
  assert.equal(isFounderProfile(null), false);
  assert.equal(isFounderProfile(undefined), false);
});
