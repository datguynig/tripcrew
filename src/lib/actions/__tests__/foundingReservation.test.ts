import assert from "node:assert/strict";
import test from "node:test";
import { claimFoundingSeat } from "@/lib/actions/foundingReservation";

// These tests exercise the validation gates that fire before any
// Supabase RPC call. Real race-condition coverage at the 500-seat
// boundary requires a live Supabase instance with the
// reserve_founding_seat function applied; that case is covered
// manually for now (see test.skip below). Same stance as the Phase 1
// teaser tests — full integration lives in Playwright + manual repro.

test("claimFoundingSeat rejects empty draftLeadId", async () => {
  const result = await claimFoundingSeat("");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "invalid_draft");
});

test("claimFoundingSeat exports foundingSeatsRemaining", async () => {
  const mod = await import("@/lib/actions/foundingReservation");
  assert.equal(typeof mod.foundingSeatsRemaining, "function");
  assert.equal(typeof mod.claimFoundingSeat, "function");
});

test.skip(
  "concurrent claims at the 500-seat boundary do not oversell",
  async () => {
    // Requires real Supabase for race coverage. Manual repro:
    //   1. Apply 20260430000100_founding_reservations.sql
    //   2. Insert 495 active holds against draft_leads_id <existing>
    //   3. Fire 50 parallel claimFoundingSeat() calls
    //   4. Assert exactly 5 succeed, 45 return { error: "sold_out" }
    // The advisory lock inside reserve_founding_seat() serialises
    // claimants so the count check + insert run atomically.
  },
);
