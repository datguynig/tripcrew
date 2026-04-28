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
 * before any human review. Two real signals (trips_per_year + non-disposable
 * email); both must pass to auto-approve. Anything else lands as a soft
 * reject so the founder gets a manual-review prompt in the admin queue.
 *
 * The earlier 5-signal version included role / pain / budget_attitude,
 * but Zod has already validated those to allowed enum values by the time
 * this runs, so they were tautologies. Stripped them — the heuristic now
 * actually discriminates instead of approving everything by default.
 *
 * Kept pure (no DB, no I/O) so it can be unit-tested and reused by both
 * the submit action and the cron auto-finaliser.
 */
export function computeProvisionalDecision(
  input: HeuristicInput,
): ProvisionalDecision {
  // Touch the strict-typed enums so future enum additions surface as a
  // typecheck failure here, prompting a deliberate review of the heuristic.
  void VALID_ROLES;
  void VALID_PAINS;
  void VALID_BUDGET_ATTITUDES;

  const hasTrips = input.trips_per_year !== "0";
  const realInbox = !DISPOSABLE_DOMAINS.has(emailDomain(input.email));

  return hasTrips && realInbox ? "approve" : "reject";
}
