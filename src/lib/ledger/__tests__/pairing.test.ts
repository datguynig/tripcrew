import test from "node:test";
import assert from "node:assert/strict";
import { decidePair } from "@/lib/ledger/pairing";

const oldOb = { id: "o1", debtor_id: "a", creditor_id: "b", due_date: "2026-04-01", amount: 100 };
const newOb = { id: "n1", debtor_id: "a", creditor_id: "b", due_date: "2026-04-01", amount: 100 };

test("decidePair returns exact when amounts match", () => {
  const result = decidePair({ old: oldOb, candidate: newOb, verified_paid_amount: 100 });
  assert.equal(result.kind, "exact");
});

test("decidePair returns partial when new is larger than verified paid", () => {
  const result = decidePair({ old: oldOb, candidate: { ...newOb, amount: 150 }, verified_paid_amount: 100 });
  assert.equal(result.kind, "partial");
});

test("decidePair returns overpayment when new is smaller than verified paid", () => {
  const result = decidePair({ old: oldOb, candidate: { ...newOb, amount: 75 }, verified_paid_amount: 100 });
  assert.equal(result.kind, "overpayment");
  assert.equal(result.excess, 25);
});

test("decidePair returns none when due_date differs", () => {
  const result = decidePair({
    old: oldOb,
    candidate: { ...newOb, due_date: "2026-05-01" },
    verified_paid_amount: 100,
  });
  assert.equal(result.kind, "none");
});

test("decidePair returns none when debtor differs", () => {
  const result = decidePair({
    old: oldOb,
    candidate: { ...newOb, debtor_id: "x" },
    verified_paid_amount: 100,
  });
  assert.equal(result.kind, "none");
});
