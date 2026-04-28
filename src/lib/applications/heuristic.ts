import type {
  ApplicationBudgetAttitude,
  ApplicationPain,
  ApplicationRole,
  ApplicationTripsPerYear,
} from "@/lib/types";

export type ProvisionalDecision = "approve" | "reject";

export type HeuristicInput = {
  trips_per_year: ApplicationTripsPerYear;
  role: ApplicationRole;
  pain: ApplicationPain;
  budget_attitude: ApplicationBudgetAttitude;
  email: string;
};

const VALID_ROLES: readonly ApplicationRole[] = [
  "organiser",
  "attendee",
  "depends",
];

const VALID_PAINS: readonly ApplicationPain[] = [
  "dates",
  "booking",
  "money",
  "plan",
  "chaos",
];

const VALID_BUDGET_ATTITUDES: readonly ApplicationBudgetAttitude[] = [
  "monopoly",
  "splurge",
  "count",
  "depends",
];

// Disposable / spam-trap mailbox providers. Real applicants use real inboxes
// — anyone routing through these is almost always a low-intent signup. Cheap
// guard, not a substitute for proper auth on the inbox at sign-in time.
const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
]);

function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at === -1) return "";
  return email.slice(at + 1).toLowerCase().trim();
}

/**
 * Returns the provisional decision a fresh application should land on
 * before any human review. Five 0/1 signals; threshold of 4 maps to
 * approve, anything below is a soft reject.
 *
 * Kept pure (no DB, no I/O) so it can be unit-tested and reused by both
 * the submit action and the cron auto-finaliser.
 */
export function computeProvisionalDecision(
  input: HeuristicInput,
): ProvisionalDecision {
  let score = 0;

  if (input.trips_per_year !== "0") score += 1;
  if (VALID_ROLES.includes(input.role)) score += 1;
  if (VALID_PAINS.includes(input.pain)) score += 1;
  if (VALID_BUDGET_ATTITUDES.includes(input.budget_attitude)) score += 1;
  if (!DISPOSABLE_DOMAINS.has(emailDomain(input.email))) score += 1;

  return score >= 4 ? "approve" : "reject";
}
