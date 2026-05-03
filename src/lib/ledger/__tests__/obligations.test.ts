import test from "node:test";
import assert from "node:assert/strict";
import { buildObligationRows } from "@/lib/ledger/obligations";
import type { Schedule } from "@/lib/types";

const baseExpense = {
  expense_id: "exp_1",
  trip_id: "trip_1",
  payer_id: "nigel",
  expense_version: 1,
  currency: "GBP",
};

const participants = [
  { user_id: "sarah", share_amount: 150, display_name_snapshot: "Sarah" },
  { user_id: "tom", share_amount: 75, display_name_snapshot: "Tom" },
];

test("buildObligationRows with schedule.none creates one row per non-payer", () => {
  const rows = buildObligationRows({
    ...baseExpense,
    payer_name: "Nigel",
    participants,
    schedule: { type: "none" } as Schedule,
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].debtor_id, "sarah");
  assert.equal(rows[0].amount, 150);
  assert.equal(rows[0].due_date, null);
  assert.equal(rows[0].installment_index, null);
});

test("buildObligationRows with schedule.single creates one row per non-payer with the date", () => {
  const rows = buildObligationRows({
    ...baseExpense,
    payer_name: "Nigel",
    participants,
    schedule: { type: "single", due_date: "2026-06-01" } as Schedule,
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].due_date, "2026-06-01");
  assert.equal(rows[0].installment_index, null);
});

test("buildObligationRows with installments creates participants × installments rows", () => {
  const rows = buildObligationRows({
    ...baseExpense,
    payer_name: "Nigel",
    participants,
    schedule: {
      type: "installments",
      installments: [
        { due_date: "2026-04-01", fraction: 0.33 },
        { due_date: "2026-05-01", fraction: 0.33 },
        { due_date: "2026-06-01", fraction: 0.34 },
      ],
    } as Schedule,
  });
  assert.equal(rows.length, 6);
  const sarahRows = rows.filter((r) => r.debtor_id === "sarah");
  assert.equal(sarahRows.length, 3);
  assert.equal(sarahRows[0].installment_index, 0);
  assert.equal(sarahRows[2].installment_index, 2);
  const sumSarah = sarahRows.reduce((s, r) => s + r.amount, 0);
  assert.equal(Math.round(sumSarah * 100) / 100, 150);
});

test("buildObligationRows skips the payer's own row", () => {
  const rows = buildObligationRows({
    ...baseExpense,
    payer_name: "Nigel",
    participants: [
      ...participants,
      { user_id: "nigel", share_amount: 100, display_name_snapshot: "Nigel" },
    ],
    schedule: { type: "none" } as Schedule,
  });
  assert.equal(rows.length, 2);
  assert.ok(!rows.some((r) => r.debtor_id === "nigel"));
});
