import test from "node:test";
import assert from "node:assert/strict";
import {
  computeEqualShares,
  computePercentageShares,
  computeExactShares,
  applyRoundingRemainder,
} from "@/lib/ledger/shares";

test("computeEqualShares splits evenly across N participants", () => {
  const result = computeEqualShares(100, ["a", "b", "c", "d"]);
  assert.deepEqual(result.map((s) => ({ user_id: s.user_id, share: s.share_amount })), [
    { user_id: "a", share: 25 },
    { user_id: "b", share: 25 },
    { user_id: "c", share: 25 },
    { user_id: "d", share: 25 },
  ]);
});

test("computeEqualShares puts rounding remainder on the last participant", () => {
  const result = computeEqualShares(100, ["a", "b", "c"]);
  assert.deepEqual(result.map((s) => s.share_amount), [33.33, 33.33, 33.34]);
});

test("computePercentageShares allocates by raw percent inputs", () => {
  const result = computePercentageShares(100, [
    { user_id: "a", input: 50 },
    { user_id: "b", input: 25 },
    { user_id: "c", input: 25 },
  ]);
  assert.deepEqual(result.map((s) => s.share_amount), [50, 25, 25]);
});

test("computePercentageShares pushes rounding remainder to last", () => {
  const result = computePercentageShares(100, [
    { user_id: "a", input: 33.33 },
    { user_id: "b", input: 33.33 },
    { user_id: "c", input: 33.34 },
  ]);
  const sum = result.reduce((s, r) => s + r.share_amount, 0);
  assert.equal(Math.round(sum * 100) / 100, 100);
});

test("computeExactShares returns user-entered amounts as-is", () => {
  const result = computeExactShares([
    { user_id: "a", input: 60 },
    { user_id: "b", input: 30 },
    { user_id: "c", input: 10 },
  ]);
  assert.deepEqual(result.map((s) => s.share_amount), [60, 30, 10]);
});

test("applyRoundingRemainder forces sum to total", () => {
  const adjusted = applyRoundingRemainder([10.01, 10.01, 10.01], 30);
  assert.deepEqual(adjusted, [10.01, 10.01, 9.98]);
});
