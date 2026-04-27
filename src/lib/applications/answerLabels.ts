import type {
  ApplicationBudgetAttitude,
  ApplicationPain,
  ApplicationRole,
  ApplicationTripsPerYear,
} from "@/lib/types";

// Single source of truth for the user-facing labels of the Q1-Q4 enum
// values. Used by:
//   - ApplicationForm (the public /apply page)
//   - ApplicationDetail (the admin queue detail view)
// The enum string values themselves live in the SQL check constraints
// (supabase/migrations/20260429000000_applications_table.sql), the Zod
// validators (src/lib/validators/application.ts), and the TS unions in
// src/lib/types.ts. If the value set changes, update all four places.

export const TRIPS_PER_YEAR_LABEL: Record<ApplicationTripsPerYear, string> = {
  "0": "0",
  "1": "1",
  "2-3": "2-3",
  "4+": "4+",
};

export const ROLE_LABEL: Record<ApplicationRole, string> = {
  organiser: "The one who organises it",
  attendee: "The one who shows up",
  depends: "Depends on the trip",
};

export const PAIN_LABEL: Record<ApplicationPain, string> = {
  dates: "Dates never align",
  booking: "Nobody books anything",
  money: "Money gets weird",
  plan: "Plan never gets made",
  chaos: "Trips happen but feel chaotic",
};

export const BUDGET_ATTITUDE_LABEL: Record<ApplicationBudgetAttitude, string> = {
  monopoly: "Treat it like monopoly money",
  splurge: "Splurge on what matters",
  count: "Make every pound count",
  depends: "It depends on the trip",
};

export const TRIPS_PER_YEAR_OPTIONS: readonly ApplicationTripsPerYear[] = [
  "0",
  "1",
  "2-3",
  "4+",
] as const;

export const ROLE_OPTIONS: readonly ApplicationRole[] = [
  "organiser",
  "attendee",
  "depends",
] as const;

export const PAIN_OPTIONS: readonly ApplicationPain[] = [
  "dates",
  "booking",
  "money",
  "plan",
  "chaos",
] as const;

export const BUDGET_ATTITUDE_OPTIONS: readonly ApplicationBudgetAttitude[] = [
  "monopoly",
  "splurge",
  "count",
  "depends",
] as const;
