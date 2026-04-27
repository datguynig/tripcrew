import type {
  ApplicationBudgetAttitude,
  ApplicationRole,
  ApplicationTripsPerYear,
} from "@/lib/types";

export const MAX_SCORE = 10;

const TRIPS_PER_YEAR_WEIGHT: Record<ApplicationTripsPerYear, number> = {
  "0": 1,
  "1": 2,
  "2-3": 4,
  "4+": 5,
};

const ROLE_WEIGHT: Record<ApplicationRole, number> = {
  organiser: 5,
  depends: 3,
  attendee: 2,
};

const BUDGET_ATTITUDE_WEIGHT: Record<ApplicationBudgetAttitude, number> = {
  monopoly: 5,
  splurge: 4,
  depends: 3,
  count: 2,
};

const MAX_RAW = 5 * 5 * 5;

export type ScoringInput = {
  trips_per_year: ApplicationTripsPerYear;
  role: ApplicationRole;
  budget_attitude: ApplicationBudgetAttitude;
};

export function scoreApplication(input: ScoringInput): number {
  const raw =
    TRIPS_PER_YEAR_WEIGHT[input.trips_per_year] *
    ROLE_WEIGHT[input.role] *
    BUDGET_ATTITUDE_WEIGHT[input.budget_attitude];
  const scaled = (raw / MAX_RAW) * MAX_SCORE;
  return Math.round(scaled * 10) / 10;
}

export function scoreExplanation(input: ScoringInput): string {
  const tripsLabel: Record<ApplicationTripsPerYear, string> = {
    "0": "Inactive traveller",
    "1": "Light traveller",
    "2-3": "Active traveller",
    "4+": "Heavy traveller",
  };
  const roleLabel: Record<ApplicationRole, string> = {
    organiser: "trip organiser (the buyer)",
    depends: "flexible role",
    attendee: "passive attendee",
  };
  const budgetLabel: Record<ApplicationBudgetAttitude, string> = {
    monopoly: "highest WTP",
    splurge: "high WTP on what matters",
    depends: "context-dependent WTP",
    count: "price-sensitive",
  };
  return `${tripsLabel[input.trips_per_year]} (Q1) · ${roleLabel[input.role]} (Q2) · ${budgetLabel[input.budget_attitude]} (Q4).`;
}
