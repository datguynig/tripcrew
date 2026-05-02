import test from "node:test";
import assert from "node:assert/strict";
import { isUnderMonthlyCap } from "@/lib/serpapi/costCap";

test("isUnderMonthlyCap returns true when no cap configured", async () => {
  const result = await isUnderMonthlyCap({
    capGbp: null,
    spendGbp: 999,
  });
  assert.equal(result.allowed, true);
});

test("isUnderMonthlyCap allows when spend below cap", async () => {
  const result = await isUnderMonthlyCap({
    capGbp: 50,
    spendGbp: 12.34,
  });
  assert.equal(result.allowed, true);
  if (result.allowed) {
    assert.equal(result.spendGbp, 12.34);
  }
});

test("isUnderMonthlyCap blocks when spend at or over cap", async () => {
  const result = await isUnderMonthlyCap({
    capGbp: 50,
    spendGbp: 50.01,
  });
  assert.equal(result.allowed, false);
  if (!result.allowed) {
    assert.equal(result.code, "monthly_budget_cap");
  }
});

test("isUnderMonthlyCap blocks when spend exactly equals cap", async () => {
  const result = await isUnderMonthlyCap({
    capGbp: 50,
    spendGbp: 50,
  });
  assert.equal(result.allowed, false);
});
