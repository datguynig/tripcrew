# Invite-only Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public, invite-only landing page with a two-stage application form, three-tier pricing, public sample trip + invite-link preview, and a founder-only admin queue to triage applications.

**Architecture:** Add a `(public)` route group whose layout opts out of auth, move the existing trip dashboard from `/` to `/dashboard`, and exempt the public surfaces from the middleware redirect. Applications submit through a Zod-validated server action into a new `applications` table; a pure scoring function ranks them. Approval emits a one-time invite token; the existing Stripe webhook closes the loop by stamping `first_paid_at` on conversion. A shared `TripPreview` server component powers both `/sample-trip/[slug]` and the rewritten public `/join/[token]`.

**Tech Stack:** Next.js 16 App Router (RSC by default), React 19, TypeScript strict, Tailwind v4 tokens, Supabase Postgres + Auth + Realtime, Zod, Stripe, Resend (transactional email), Vitest (unit), Playwright (e2e).

---

## Phase 1: Schema foundations

Goal of phase: every database surface the feature needs (applications table, founder flag, founding-crew flag) lands in migrations with RLS locked down. After this phase, the database can hold applications even though no UI submits them yet.

### Task 1: Applications table migration

**Files:**
- Create: `supabase/migrations/20260429000000_applications_table.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260429000000_applications_table.sql
-- Captures the qualified-application gate: visitor email + Q1-Q4 answers,
-- approval lifecycle, conversion attribution. RLS denies all access by
-- default; only the service role (server actions) and founder admin
-- writes/reads.

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),

  trips_per_year text not null check (trips_per_year in ('0','1','2-3','4+')),
  role text not null check (role in ('organiser','attendee','depends')),
  pain text not null check (pain in ('dates','booking','money','plan','chaos')),
  budget_attitude text not null check (budget_attitude in ('monopoly','splurge','count','depends')),

  approved_at timestamptz,
  approved_by uuid references profiles(id) on delete set null,
  invite_token text unique,
  invite_sent_at timestamptz,
  user_id uuid references profiles(id) on delete set null,
  activated_at timestamptz,
  first_trip_at timestamptz,
  first_lock_at timestamptz,
  first_paid_at timestamptz,

  utm_source text,
  utm_campaign text,
  referrer text
);

create index applications_user_id_idx on applications(user_id);
create index applications_pending_idx on applications(approved_at) where user_id is null and approved_at is null;
create index applications_invite_token_idx on applications(invite_token) where invite_token is not null;

alter table applications enable row level security;

-- Anonymous applicants can insert their own row. Read-back is denied
-- (the action returns the id directly to avoid exposing other rows).
create policy "applications_insert_anon" on applications
  for insert
  to anon, authenticated
  with check (true);
```

- [ ] **Step 2: Apply the migration locally**

Run: `pnpm supabase db reset` (assumes a local stack) or push to a branch DB.
Expected: migration applies cleanly, no error from the linter.

- [ ] **Step 3: Verify the schema**

Run: `pnpm supabase db diff` against an empty database.
Expected: shows the new table + indexes.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260429000000_applications_table.sql
git commit -m "feat(db): add applications table for invite-only gate"
```

### Task 2: Admin columns + founder flag migration

**Files:**
- Create: `supabase/migrations/20260429000100_applications_admin_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260429000100_applications_admin_columns.sql
-- Admin triage adds: rejected_at/rejected_by audit columns, free-text notes
-- so the founder can scribble context, and a global is_founder flag on
-- profiles to gate /admin/applications/* routes (separate from per-trip
-- admin role on trip_members).

alter table applications add column rejected_at timestamptz;
alter table applications add column rejected_by uuid references profiles(id) on delete set null;
alter table applications add column admin_notes text;

alter table profiles add column is_founder boolean not null default false;

create index applications_rejected_at_idx on applications(rejected_at) where rejected_at is not null;

-- Founder reads. Service-role bypasses RLS for server actions; this policy
-- supports anything the founder reads via their own session (e.g. the
-- analytics dashboard if we ever switch off service role for it).
create policy "applications_founder_read" on applications
  for select
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = (select auth.uid()) and p.is_founder = true
    )
  );

create policy "applications_founder_update" on applications
  for update
  to authenticated
  using (
    exists (
      select 1 from profiles p
      where p.id = (select auth.uid()) and p.is_founder = true
    )
  );
```

- [ ] **Step 2: Apply and verify**

Run: `pnpm supabase db reset` (or branch push).
Expected: applies cleanly. Inspect `\d applications` and `\d profiles` to confirm new columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260429000100_applications_admin_columns.sql
git commit -m "feat(db): add applications admin columns and profiles.is_founder"
```

### Task 3: Founding Crew counter migration

**Files:**
- Create: `supabase/migrations/20260429000200_founding_crew_flag.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260429000200_founding_crew_flag.sql
-- The "47 / 500 LEFT" counter on the pricing block reads from
-- count(profiles.founding_crew_at is not null). Stripe webhook stamps
-- this column when a customer.subscription.created arrives with the
-- founding-crew price ID. Nullable so existing rows are unaffected.

alter table profiles add column founding_crew_at timestamptz;

create index profiles_founding_crew_idx on profiles(founding_crew_at) where founding_crew_at is not null;
```

- [ ] **Step 2: Apply and verify**

Run: `pnpm supabase db reset`.
Expected: column exists. `select count(*) from profiles where founding_crew_at is not null` returns 0.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260429000200_founding_crew_flag.sql
git commit -m "feat(db): add profiles.founding_crew_at for tier counter"
```

### Task 4: Type updates for new tables and flags

**Files:**
- Modify: `src/lib/types.ts` — add `Application`, `Profile.is_founder`, `Profile.founding_crew_at`

- [ ] **Step 1: Add the Application type**

Open `src/lib/types.ts`. Add at the bottom of the file:

```ts
export type ApplicationTripsPerYear = "0" | "1" | "2-3" | "4+";
export type ApplicationRole = "organiser" | "attendee" | "depends";
export type ApplicationPain = "dates" | "booking" | "money" | "plan" | "chaos";
export type ApplicationBudgetAttitude =
  | "monopoly"
  | "splurge"
  | "count"
  | "depends";

export type Application = {
  id: string;
  email: string;
  created_at: string;
  trips_per_year: ApplicationTripsPerYear;
  role: ApplicationRole;
  pain: ApplicationPain;
  budget_attitude: ApplicationBudgetAttitude;
  approved_at: string | null;
  approved_by: string | null;
  invite_token: string | null;
  invite_sent_at: string | null;
  user_id: string | null;
  activated_at: string | null;
  first_trip_at: string | null;
  first_lock_at: string | null;
  first_paid_at: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  admin_notes: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  referrer: string | null;
};
```

- [ ] **Step 2: Extend Profile**

Find the existing `Profile` type. Add these two fields (preserve all existing fields):

```ts
  is_founder: boolean;
  founding_crew_at: string | null;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. If existing Profile selects in other files break, leave them — they use `*` or explicit lists; new fields are optional reads.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "types: add Application and profile flag types"
```

### Phase 1 closeout — simplify + code-review

Goal: catch reuse opportunities, quality issues, and review-worthy concerns before the next phase begins. Run on the changes made in this phase only.

- [ ] **Step 1: Identify the files changed in this phase**

Run: `git log --since="Phase 1 start" --name-only --pretty=format: | sort -u | grep -v '^$'`
If unsure of the phase-start commit, the four Phase 1 commits are the four most recent: `git log --oneline -4`.

- [ ] **Step 2: Invoke the `simplify` skill**

Use the Skill tool with `skill: "simplify"`. Brief:

> Review the migration files and type updates from Phase 1. The migrations declare schema, indexes, and RLS for `applications` and add columns to `profiles`. Look for redundant indexes, missing nullability constraints, RLS policies that are too permissive or too restrictive, and type definitions that drift from the SQL columns. Skip cosmetic SQL formatting unless it materially affects readability.

- [ ] **Step 3: Invoke the `code-review:code-review` skill**

Use the Skill tool with `skill: "code-review:code-review"`. Brief:

> Review Phase 1 commits against the plan at `docs/superpowers/plans/2026-04-27-invite-only-landing-page.md` and the conventions in `CLAUDE.md`. Focus on: RLS correctness for the `applications` table (anon insert OK, founder-only read/update), index choices (do they match the queries the queue and analytics will run?), nullability of new columns, and whether the `Application` TypeScript type matches the SQL exactly. Flag any drift.

- [ ] **Step 4: Apply the migrations end-to-end**

Run: `pnpm supabase db reset`
Expected: all four Phase 1 migrations apply cleanly with no warnings.

- [ ] **Step 5: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit any fixes**

If either skill produced changes:

```bash
git add -A
git commit -m "chore(phase 1): apply simplify + code-review feedback"
```

If no changes were needed, skip the commit and move to Phase 2.

---

**Phase 1 ship-ready check:** Database holds applications and tracks founder/founding-crew flags. Nothing user-facing changed yet.

---

## Phase 2: Scoring + validators (pure logic, TDD)

Goal of phase: deterministic scoring function + Zod schemas for the application form, both fully unit-tested. After this phase, the scoring algorithm is locked and trustworthy before any UI plugs into it.

### Task 5: Application scoring function

**Files:**
- Create: `src/lib/applications/scoring.ts`
- Create: `src/lib/applications/__tests__/scoring.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/applications/__tests__/scoring.test.ts
import { describe, expect, it } from "vitest";
import { scoreApplication, MAX_SCORE } from "../scoring";

describe("scoreApplication", () => {
  it("returns max score for the highest-WTP segment", () => {
    const result = scoreApplication({
      trips_per_year: "4+",
      role: "organiser",
      budget_attitude: "monopoly",
    });
    expect(result).toBe(10);
  });

  it("scales output to a 0-10 range", () => {
    const result = scoreApplication({
      trips_per_year: "0",
      role: "attendee",
      budget_attitude: "count",
    });
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(10);
  });

  it("ranks an active organiser above an occasional attendee at the same budget", () => {
    const organiser = scoreApplication({
      trips_per_year: "2-3",
      role: "organiser",
      budget_attitude: "splurge",
    });
    const attendee = scoreApplication({
      trips_per_year: "1",
      role: "attendee",
      budget_attitude: "splurge",
    });
    expect(organiser).toBeGreaterThan(attendee);
  });

  it("rounds to one decimal place", () => {
    const result = scoreApplication({
      trips_per_year: "2-3",
      role: "depends",
      budget_attitude: "splurge",
    });
    expect(result.toString()).toMatch(/^\d(\.\d)?$/);
  });

  it("exposes MAX_SCORE for callers that scale the bar visualisation", () => {
    expect(MAX_SCORE).toBe(10);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `pnpm exec vitest run src/lib/applications/__tests__/scoring.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the scoring function**

```ts
// src/lib/applications/scoring.ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/applications/__tests__/scoring.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/applications/scoring.ts src/lib/applications/__tests__/scoring.test.ts
git commit -m "feat(applications): add scoring function with weights"
```

### Task 6: Application form Zod validators

**Files:**
- Create: `src/lib/validators/application.ts`
- Create: `src/lib/validators/__tests__/application.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/validators/__tests__/application.test.ts
import { describe, expect, it } from "vitest";
import {
  applicationEmailSchema,
  applicationAnswersSchema,
  fullApplicationSchema,
} from "../application";

describe("applicationEmailSchema", () => {
  it("accepts a normal email", () => {
    expect(applicationEmailSchema.safeParse("a@b.co").success).toBe(true);
  });
  it("rejects empty input", () => {
    expect(applicationEmailSchema.safeParse("").success).toBe(false);
  });
  it("rejects non-email strings", () => {
    expect(applicationEmailSchema.safeParse("not an email").success).toBe(false);
  });
});

describe("applicationAnswersSchema", () => {
  it("accepts the four enumerated answers", () => {
    expect(
      applicationAnswersSchema.safeParse({
        trips_per_year: "2-3",
        role: "organiser",
        pain: "dates",
        budget_attitude: "monopoly",
      }).success,
    ).toBe(true);
  });

  it("rejects an unexpected pain value", () => {
    expect(
      applicationAnswersSchema.safeParse({
        trips_per_year: "2-3",
        role: "organiser",
        pain: "everything",
        budget_attitude: "monopoly",
      }).success,
    ).toBe(false);
  });
});

describe("fullApplicationSchema", () => {
  it("requires email + all four answers + accepts optional UTM", () => {
    const result = fullApplicationSchema.safeParse({
      email: "a@b.co",
      trips_per_year: "1",
      role: "depends",
      pain: "booking",
      budget_attitude: "count",
      utm_source: "twitter",
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/validators/__tests__/application.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the schemas**

```ts
// src/lib/validators/application.ts
import { z } from "zod";

export const applicationEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email.");

export const applicationAnswersSchema = z.object({
  trips_per_year: z.enum(["0", "1", "2-3", "4+"]),
  role: z.enum(["organiser", "attendee", "depends"]),
  pain: z.enum(["dates", "booking", "money", "plan", "chaos"]),
  budget_attitude: z.enum(["monopoly", "splurge", "count", "depends"]),
});

export const fullApplicationSchema = applicationAnswersSchema.extend({
  email: applicationEmailSchema,
  utm_source: z.string().max(120).optional(),
  utm_campaign: z.string().max(120).optional(),
  referrer: z.string().max(2048).optional(),
});

export type ApplicationAnswers = z.infer<typeof applicationAnswersSchema>;
export type FullApplicationInput = z.infer<typeof fullApplicationSchema>;
```

- [ ] **Step 4: Run the test**

Run: `pnpm exec vitest run src/lib/validators/__tests__/application.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validators/application.ts src/lib/validators/__tests__/application.test.ts
git commit -m "feat(applications): add zod validators for email + answers"
```

### Task 7: Pain-mirror copy helper

The confirmation page and welcome email both echo the visitor's Q3 answer back. Centralise the copy so both surfaces stay in sync.

**Files:**
- Create: `src/lib/applications/painCopy.ts`
- Create: `src/lib/applications/__tests__/painCopy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/applications/__tests__/painCopy.test.ts
import { describe, expect, it } from "vitest";
import { painMirror, painEmailOpener } from "../painCopy";

describe("painMirror", () => {
  it("returns the confirmation-page mirror line for each pain value", () => {
    expect(painMirror("dates")).toBe("You said dates never align.");
    expect(painMirror("booking")).toBe("You said nobody books anything.");
    expect(painMirror("money")).toBe("You said money gets weird.");
    expect(painMirror("plan")).toBe("You said the plan never gets made.");
    expect(painMirror("chaos")).toBe(
      "You said your trips happen but feel chaotic.",
    );
  });
});

describe("painEmailOpener", () => {
  it("returns the welcome-email opener for each pain value", () => {
    expect(painEmailOpener("dates")).toContain("dates");
    expect(painEmailOpener("booking")).toContain("books");
    expect(painEmailOpener("money")).toContain("money");
    expect(painEmailOpener("plan")).toContain("plan");
    expect(painEmailOpener("chaos")).toContain("chaotic");
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `pnpm exec vitest run src/lib/applications/__tests__/painCopy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the copy module**

```ts
// src/lib/applications/painCopy.ts
import type { ApplicationPain } from "@/lib/types";

const MIRROR: Record<ApplicationPain, string> = {
  dates: "You said dates never align.",
  booking: "You said nobody books anything.",
  money: "You said money gets weird.",
  plan: "You said the plan never gets made.",
  chaos: "You said your trips happen but feel chaotic.",
};

const EMAIL_OPENER: Record<ApplicationPain, string> = {
  dates: "You told us dates never align. We rebuilt that part first.",
  booking: "You told us nobody ever books anything. We fixed the booking handoff.",
  money: "You told us money gets weird. The ledger settles itself now.",
  plan: "You told us the plan never gets made. The AI drafts it for you.",
  chaos: "You told us trips happen but feel chaotic. We made them feel calm.",
};

export function painMirror(pain: ApplicationPain): string {
  return MIRROR[pain];
}

export function painEmailOpener(pain: ApplicationPain): string {
  return EMAIL_OPENER[pain];
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm exec vitest run src/lib/applications/__tests__/painCopy.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/applications/painCopy.ts src/lib/applications/__tests__/painCopy.test.ts
git commit -m "feat(applications): add pain-mirror copy helpers"
```

### Phase 2 closeout — simplify + code-review

- [ ] **Step 1: Identify the files changed in this phase**

Run: `git log -3 --name-only --pretty=format: | sort -u | grep -v '^$'`
Expected: the three Phase 2 commits cover `src/lib/applications/scoring.ts`, `src/lib/validators/application.ts`, `src/lib/applications/painCopy.ts`, plus their `__tests__` siblings.

- [ ] **Step 2: Invoke the `simplify` skill**

Use the Skill tool with `skill: "simplify"`. Brief:

> Review the pure-logic helpers added in Phase 2 (scoring, validators, pain-mirror copy). Look for dead code paths, opportunities to derive types from Zod schemas (use `z.infer` rather than re-declaring), redundant defensive checks on enum values that the type system already constrains, and any string-literal duplication between scoring weights and validator enums. Skip suggestions that conflict with the project's "no comments explaining WHAT" rule.

- [ ] **Step 3: Invoke the `code-review:code-review` skill**

Use the Skill tool with `skill: "code-review:code-review"`. Brief:

> Review Phase 2 commits. Verify: (a) `scoreApplication` is deterministic and pure — no side effects, no env reads; (b) the weights produce the expected ranking (organiser+monopoly highest, attendee+count lowest); (c) Zod enums match the SQL `check` constraints from Phase 1 exactly; (d) the pain-mirror strings have no emoji or competitor brand names. Run `pnpm exec vitest run` to confirm green.

- [ ] **Step 4: Run the test suite**

Run: `pnpm exec vitest run`
Expected: all Phase 2 tests pass.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(phase 2): apply simplify + code-review feedback"
```

Skip if no changes were needed.

---

**Phase 2 ship-ready check:** Pure logic is locked. Scoring is deterministic and tested; validators reject bad input; pain-mirror copy is in one place. Nothing user-facing yet.

---

## Phase 3: Visitor application flow

Goal of phase: a visitor can submit Q1-Q4 + email and land on a personalised confirmation. Submissions persist to the database. Read by humans only — approval flow is Phase 6.

### Task 8: submitApplication server action

**Files:**
- Create: `src/lib/actions/applications.ts`
- Create: `src/lib/actions/__tests__/applications.test.ts` (unit smoke; full e2e in Task 11)

- [ ] **Step 1: Write the failing test for the input shape**

```ts
// src/lib/actions/__tests__/applications.test.ts
import { describe, expect, it } from "vitest";
import { fullApplicationSchema } from "@/lib/validators/application";

describe("submitApplication input contract", () => {
  it("matches the fullApplicationSchema shape", () => {
    const candidate = {
      email: "a@b.co",
      trips_per_year: "2-3" as const,
      role: "organiser" as const,
      pain: "dates" as const,
      budget_attitude: "monopoly" as const,
      utm_source: undefined,
      utm_campaign: undefined,
      referrer: undefined,
    };
    expect(fullApplicationSchema.safeParse(candidate).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm exec vitest run src/lib/actions/__tests__/applications.test.ts`
Expected: PASS — exercises the validator alone.

- [ ] **Step 3: Implement the server action**

```ts
// src/lib/actions/applications.ts
"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { fullApplicationSchema } from "@/lib/validators/application";
import type {
  ApplicationBudgetAttitude,
  ApplicationPain,
  ApplicationRole,
  ApplicationTripsPerYear,
} from "@/lib/types";

type SubmitApplicationInput = {
  email: string;
  trips_per_year: ApplicationTripsPerYear;
  role: ApplicationRole;
  pain: ApplicationPain;
  budget_attitude: ApplicationBudgetAttitude;
  utm_source?: string;
  utm_campaign?: string;
  referrer?: string;
};

type SubmitResult =
  | { ok: true; pain: ApplicationPain }
  | { ok?: false; error: string };

export async function submitApplication(
  input: SubmitApplicationInput,
): Promise<SubmitResult> {
  const parsed = fullApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Some answers were missing or invalid." };
  }

  const supabase = createServiceClient();

  const { error } = await supabase.from("applications").insert({
    email: parsed.data.email,
    trips_per_year: parsed.data.trips_per_year,
    role: parsed.data.role,
    pain: parsed.data.pain,
    budget_attitude: parsed.data.budget_attitude,
    utm_source: parsed.data.utm_source ?? null,
    utm_campaign: parsed.data.utm_campaign ?? null,
    referrer: parsed.data.referrer ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: true, pain: parsed.data.pain };
    }
    console.error("submitApplication insert failed", error);
    return { error: "Something went wrong. Try again in a moment." };
  }

  return { ok: true, pain: parsed.data.pain };
}

export async function getApplicationCount(): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}
```

- [ ] **Step 4: Verify TS compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/applications.ts src/lib/actions/__tests__/applications.test.ts
git commit -m "feat(applications): add submitApplication server action"
```

### Task 9: Stage 2 — `/apply` form page

**Files:**
- Create: `src/components/marketing/ApplicationForm.tsx`
- Create: `src/app/(public)/apply/page.tsx`

(`(public)` group layout is created in Task 13 before the route is reachable; the form file is written now, the layout wires up when the dashboard moves.)

**Design brief (pass verbatim to the `frontend-design:frontend-design` skill):**

> Build `ApplicationForm` — a four-question multiple-choice form, plus its host page at `/apply`.
>
> **Aesthetic.** Editorial-brutalist. Cream-light background `bg-[var(--bg)]` (cream `#f5f1e8`), ink-dark text `text-[var(--ink)]` (`#0a0a0a`). Mono-cap labels for question numbers/prompts (`font-mono uppercase tracking-[0.18em]`). Serif display only for the page heading. Hard 2px borders. Selected option is fully filled (black bg, cream text); unselected is a thin border. No rounding, no shadows, no gradients, no emojis. No competitor brand names. Tailwind v4 tokens defined in `src/app/globals.css @theme` — never hex inline if a token exists.
>
> **Page layout** (`/apply`):
> - Mono-cap label above the heading: `Application · 4 quick questions · 90 seconds`
> - Heading (serif, ~42px): `One last thing.`
> - Form below, single column, max-width ~680px
> - On mount, if `?email` query param is missing, redirect to `/`
>
> **Form layout** (`ApplicationForm`):
> - Four `<fieldset>` blocks stacked vertically, each labelled by `<legend>` with the question number + prompt in mono caps
> - Q1 options laid out in a row (4 small buttons); Q2-Q4 options stack vertically as wider buttons
> - Submit button anchored at the bottom-left, disabled until all four questions answered
> - Submit button label: `Submit application →` (becomes `Submitting...` while the action runs)
> - Inline error message in mono caps red above the submit when `submitApplication` returns an error
>
> **EXACT copy — preserve verbatim, do not rephrase:**
>
> Q1 prompt: `Trips per year`
> Q1 options: `0`, `1`, `2-3`, `4+`
> Q1 value mapping: `"0"`, `"1"`, `"2-3"`, `"4+"`
>
> Q2 prompt: `When your crew talks about a trip, you're...`
> Q2 options:
>   - `The one who organises it` → `"organiser"`
>   - `The one who shows up` → `"attendee"`
>   - `Depends on the trip` → `"depends"`
>
> Q3 prompt: `What kills most of your trips?`
> Q3 options:
>   - `Dates never align` → `"dates"`
>   - `Nobody books anything` → `"booking"`
>   - `Money gets weird` → `"money"`
>   - `Plan never gets made` → `"plan"`
>   - `Trips happen but feel chaotic` → `"chaos"`
>
> Q4 prompt: `When it comes to trip budgets, you...`
> Q4 options:
>   - `Treat it like monopoly money` → `"monopoly"`
>   - `Splurge on what matters` → `"splurge"`
>   - `Make every pound count` → `"count"`
>   - `It depends on the trip` → `"depends"`
>
> **Behaviour.** On submit:
> ```ts
> import { submitApplication } from "@/lib/actions/applications";
> // call submitApplication({ email, trips_per_year, role, pain, budget_attitude });
> // on { ok: true, pain }: router.push(`/apply/confirmation?p=${pain}`)
> // on { error }: set local error state to the error string
> ```
> Use `useTransition` so the disabled state is correct under server-action latency.
>
> **Types.** Import the four enum types from `@/lib/types`:
> ```ts
> import type {
>   ApplicationBudgetAttitude,
>   ApplicationPain,
>   ApplicationRole,
>   ApplicationTripsPerYear,
> } from "@/lib/types";
> ```
> No re-declared string-literal unions for the answer values.
>
> **Conventions.** `"use client"` only on `ApplicationForm.tsx` (the page is a server component). No comments explaining what code does. Compose around `Button` from `@/components/ui/Button` if its variants fit; otherwise plain `<button>` with token-based classes is fine for this brutalist treatment.

- [ ] **Step 1: Invoke the `frontend-design:frontend-design` skill with the design brief above**

Pass the brief verbatim. The skill produces production-grade React + Tailwind code.

- [ ] **Step 2: Verify the output against project conventions**

Conformance checklist:
- [ ] No emoji codepoints anywhere in the JSX or strings
- [ ] No competitor brand names (`Splitwise`, `WhatsApp`, `Google Flights`)
- [ ] Colors reference Tailwind tokens (e.g. `bg-bg`, `text-ink`, or whatever the project's `@theme` declares); inline hex codes only when a token is genuinely unavailable
- [ ] Composes around primitives in `src/components/ui/` where they fit
- [ ] Imports the four enum types from `@/lib/types` — does not redeclare them
- [ ] Calls `submitApplication` from `@/lib/actions/applications`
- [ ] Server component for the page, client component only for the form
- [ ] All four questions render the EXACT copy from the brief, verbatim

If any item fails, ask the skill to fix that specific item.

- [ ] **Step 3: Write the files at their target paths**

Place the skill's output at:
- `src/components/marketing/ApplicationForm.tsx` (the client form component)
- `src/app/(public)/apply/page.tsx` (the server page that mounts it)

- [ ] **Step 4: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Visual verification (deferred until Phase 4)**

Phase 4 unblocks the route. After it completes, navigate to `/apply?email=test@test.local` and confirm:
- Heading reads `One last thing.`
- All four questions render with their exact prompts and options
- Selecting an option fills it black; unselected stays bordered
- Submit is disabled until all four answered
- Submit text is `Submit application →`

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/ApplicationForm.tsx src/app/\(public\)/apply/page.tsx
git commit -m "feat(apply): add stage-2 application form with Q1-Q4"
```

### Task 10: Stage 3 — `/apply/confirmation` page

**Files:**
- Create: `src/app/(public)/apply/confirmation/page.tsx`

**Design brief (pass verbatim to the `frontend-design:frontend-design` skill):**

> Build the application confirmation page at `/apply/confirmation`. Read-only, server-rendered, full-screen.
>
> **Aesthetic.** Same editorial-brutalist baseline as `/apply`. Cream background, ink text. Centered single column, max-width ~640px. Serif display heading, mono-cap labels at top and bottom. No emoji. No competitor brand names. Tailwind tokens (`bg-bg`, `text-ink`, etc.) — never hex inline if a token is available.
>
> **Layout** (vertical, centered):
> 1. Mono-cap eyebrow: `APPLICATION RECEIVED`
> 2. Large serif headline (~40px): the pain mirror line — `painMirror(pain)` — looked up via the helper module described below
> 3. Smaller serif line (~24px): `That's what we're best at.`
> 4. Body sans (~16px), max-width ~480px, ~75% opacity:
>    `We approve in batches. Expect an invite within 14 days. Members can also fast-track you — if a friend's already on Tripcrew, ask them to send you one of their slots.`
> 5. Mono-cap footer: `<count> on the list · ~30 invited per week` — where `<count>` is from `getApplicationCount()` and locale-formatted with `toLocaleString("en-GB")`.
>
> **Behaviour.**
> ```ts
> import { redirect } from "next/navigation";
> import { painMirror } from "@/lib/applications/painCopy";
> import { getApplicationCount } from "@/lib/actions/applications";
> import type { ApplicationPain } from "@/lib/types";
>
> export const dynamic = "force-dynamic";
> ```
> The page reads `?p=<pain>` from `searchParams`. If `p` is missing or not one of the five valid pain values (`dates`, `booking`, `money`, `plan`, `chaos`), `redirect("/")`. Use a type guard, not a cast.
>
> **No client component needed** — server-render the count and the mirror line.

- [ ] **Step 1: Invoke the `frontend-design:frontend-design` skill with the brief**

Pass the brief verbatim.

- [ ] **Step 2: Verify the output against project conventions**

Conformance checklist:
- [ ] No emoji codepoints
- [ ] No competitor brand names
- [ ] Tailwind tokens used for colors/spacing
- [ ] Server component (no `"use client"` directive)
- [ ] Imports `painMirror` from `@/lib/applications/painCopy`
- [ ] Imports `getApplicationCount` from `@/lib/actions/applications`
- [ ] Type-narrows `searchParams.p` against `ApplicationPain` before use; redirects on miss
- [ ] All copy reproduced verbatim from the brief

- [ ] **Step 3: Write the file at the target path**

`src/app/(public)/apply/confirmation/page.tsx`

- [ ] **Step 4: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(public\)/apply/confirmation/page.tsx
git commit -m "feat(apply): add personalised confirmation page"
```

### Task 11: End-to-end submission smoke test

**Files:**
- Create: `tests/applications-flow.spec.ts`

(This task assumes Phase 4's middleware change is in place; we'll re-run after Phase 4. Write the test now so executing the phase doesn't reset the muscle memory.)

- [ ] **Step 1: Write the Playwright test**

```ts
// tests/applications-flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("application flow", () => {
  test("visitor submits an application and lands on confirmation", async ({
    page,
  }) => {
    await page.goto("/apply?email=" + encodeURIComponent("e2e@test.local"));
    await expect(page.getByRole("heading", { name: "One last thing." })).toBeVisible();

    await page.getByRole("button", { name: "2-3" }).click();
    await page.getByRole("button", { name: "The one who organises it" }).click();
    await page.getByRole("button", { name: "Dates never align" }).click();
    await page.getByRole("button", { name: "Treat it like monopoly money" }).click();

    await page.getByRole("button", { name: /Submit application/i }).click();

    await expect(page).toHaveURL(/\/apply\/confirmation\?p=dates/);
    await expect(
      page.getByRole("heading", { name: "You said dates never align." }),
    ).toBeVisible();
  });
});
```

- [ ] **Step 2: Note the deferred verification**

This test will run green only after Phase 4 makes `/apply` reachable without auth and Phase 1's migration is applied. Until then, it serves as a written contract.

- [ ] **Step 3: Commit**

```bash
git add tests/applications-flow.spec.ts
git commit -m "test(apply): add e2e application submission spec"
```

### Phase 3 closeout — simplify + code-review

- [ ] **Step 1: Identify the files changed in this phase**

Run: `git log -4 --name-only --pretty=format: | sort -u | grep -v '^$'`
Expected: the four Phase 3 commits cover `src/lib/actions/applications.ts`, `src/components/marketing/ApplicationForm.tsx`, `src/app/(public)/apply/page.tsx`, `src/app/(public)/apply/confirmation/page.tsx`, and `tests/applications-flow.spec.ts`.

- [ ] **Step 2: Invoke the `simplify` skill**

Use the Skill tool with `skill: "simplify"`. Brief:

> Review the application submission flow added in Phase 3. The server action, the form, and the confirmation page should DRY against the Zod validators from Phase 2 (no re-declared enum lists). Flag any place where the answer enums or the labels live in more than one source. Verify the `/apply/confirmation` page redirects on missing/invalid `p` rather than rendering empty.

- [ ] **Step 3: Invoke the `code-review:code-review` skill**

Use the Skill tool with `skill: "code-review:code-review"`. Brief:

> Review Phase 3 commits. Focus on: (a) `submitApplication` correctness — does the duplicate-email path (`23505`) return the same shape as success? (b) is the form's Q3 (pain) value actually persisted before the redirect to `/apply/confirmation?p=...`? (c) does the form gracefully degrade when JS is disabled (it doesn't have to, but flag it if relevant)? (d) any leakage of the service-role client into the client bundle (it shouldn't compile if so, but verify the import map).

- [ ] **Step 4: Run the test suite**

Run: `pnpm exec vitest run`
Expected: all unit tests pass. The Playwright spec at `tests/applications-flow.spec.ts` is deferred until Phase 4 makes `/apply` reachable.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(phase 3): apply simplify + code-review feedback"
```

Skip if no changes were needed.

---

**Phase 3 ship-ready check:** Submission code path is complete in code; not yet reachable from a browser because `/apply` lives under `(public)` and the middleware still gates it. End of Phase 4 makes it usable.

---

## Phase 4: Public route group + landing page

Goal of phase: unauthed visitors hit `/` and see the landing page; authed users get bounced to `/dashboard`. All six landing blocks render, plus the link to the sample-trip page (which is built in Phase 5).

### Task 12: Move the existing dashboard to `/dashboard`

**Files:**
- Modify: rename `src/app/(app)/page.tsx` → `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Rename the dashboard route**

```bash
mkdir -p src/app/\(app\)/dashboard
git mv src/app/\(app\)/page.tsx src/app/\(app\)/dashboard/page.tsx
```

- [ ] **Step 2: Update internal links that pointed at `/`**

Run: `grep -rn "href=\"/\"" src/app src/components src/lib --include="*.tsx" --include="*.ts"`
For each result that meant "the dashboard" (not the marketing landing — there is none yet), change `"/"` to `"/dashboard"`.

Expected affected files (verify the actual list at runtime):
- `src/app/(app)/layout.tsx` (TopBar logo link)
- `src/components/feed/Feed.tsx` (notification bell home action, if any)
- `src/components/account/SubscriptionPanel.tsx` (post-checkout redirect, if any)

- [ ] **Step 3: Verify TypeScript and dev render**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. Then `pnpm dev`, sign in, navigate to `/dashboard` and confirm the trip list renders.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(routes): move trip dashboard from / to /dashboard"
```

### Task 13: `(public)` route group layout + middleware exemption

**Files:**
- Create: `src/app/(public)/layout.tsx`
- Modify: `src/lib/supabase/middleware.ts:32-50`

- [ ] **Step 1: Create the public layout**

```tsx
// src/app/(public)/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tripcrew — trips that make it out of the group chat",
  description:
    "Invite-only group trip planner. Pick a city. Pull your crew. Make memories, not just wishes.",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="bg-[#f5f1e8] text-[#0a0a0a]">{children}</div>;
}
```

- [ ] **Step 2: Update middleware to exempt public routes and bounce authed visitors away from `/`**

Open `src/lib/supabase/middleware.ts`. Replace lines 32-56 (the section starting `const { pathname }` through `return response;`) with:

```ts
  const { pathname } = request.nextUrl;
  const isServerAction = request.headers.has("next-action");

  // Routes the auth check should never redirect away from.
  const PUBLIC_PREFIXES = [
    "/sign-in",
    "/callback",
    "/profile",
    "/join",
    "/apply",
    "/sample-trip",
  ];
  const isPublicRoute =
    pathname === "/" ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isServerAction) {
    return response;
  }

  // Authed user landing on the public marketing root — send them to the
  // app dashboard so they don't see the marketing page on every login.
  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/sign-in") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
```

- [ ] **Step 3: Manually verify**

Run: `pnpm dev`. While signed out, visit `/`. Expected: 200 with "no page yet" (the public route file is still missing — Task 18 wires it). While signed in, visit `/`. Expected: 307 redirect to `/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(public\)/layout.tsx src/lib/supabase/middleware.ts
git commit -m "feat(routes): add public route group and exempt from auth"
```

### Task 14: Hero component

**Files:**
- Create: `src/components/marketing/Hero.tsx`
- Create: `src/components/marketing/MembershipStamp.tsx`

**Design brief (pass verbatim to the `frontend-design:frontend-design` skill):**

> Build the landing-page hero — the above-the-fold section of `/`. Two sub-components: `Hero` (the section) and `MembershipStamp` (the wax-seal-style overlay).
>
> **Aesthetic.** Editorial-brutalist. Hero background is INK-DARK (`#0a0a0a`), text is CREAM (`#f5f1e8`). Hard 2px borders. Mono caps for labels and microcopy. Serif display for the headline. Accent coral (`#ff5e3a`) used sparingly. No emoji. No competitor brand names. Tailwind v4 tokens defined in `src/app/globals.css @theme` — never hex inline if a token exists.
>
> **Layout** (`Hero`):
> - Two-column grid on desktop (`md:grid-cols-2`), single column on mobile
> - Left column: serif headline + sans subline
> - Right column: a "transformation split" — a 2-column inner widget showing "the group chat" (dying out, struck-through chat bubbles) on the left, "the trip" (a clean trip tile on cream) on the right
> - Below the two-column row: a CTA bar with email input + Continue button + microcopy + secondary "Have an invite?" link
> - `MembershipStamp` overlays the top-right corner of the section, slightly rotated (`-rotate-[8deg]`)
>
> **EXACT copy — verbatim:**
>
> Headline: `Trips that make it out of the group chat.`
> Subline: `Pick a city. Pull your crew. Make memories, not just wishes.`
> Email placeholder: `your@email.com`
> Email aria-label: `Email address`
> Primary button: `Continue →`
> Microcopy: `4 quick questions next · 90 seconds`
> Secondary link: `Have an invite? Enter →`
>
> Membership stamp: `Invite only · <count> on list` — where `<count>` is the prop, locale-formatted via `toLocaleString("en-GB")`. Mono caps, accent coral or ink-on-cream depending on contrast.
>
> Transformation split — left side ("the group chat"):
> - Mono-cap label: `The group chat`
> - 4 chat bubbles, all sans, ~55% opacity, with `line-through` decoration:
>   - `anyone free in june?`
>   - `depends on dates`
>   - `lisbon? portugal?`
>   - `i'll check flights later`
> - Mono-cap footer at low opacity: `... 47 unread`
>
> Transformation split — right side ("the trip"), cream background:
> - Mono-cap label: `The trip`
> - Serif heading: `Lisbon`
> - Mono-cap subline: `Jun 14 — Jun 19 · 6 days · 6 crew`
> - 4-cell spec grid (mono caps, hard borders):
>   - `Per head` / `£820`
>   - `Crew` / `6`
>   - `From` / `LHR`
>   - `Vibes` / `Foodie · Wine`
>
> **Behaviour.** `Hero` is a client component. Email validation uses the SAME Zod schema as the server action — do not redeclare:
> ```ts
> import { applicationEmailSchema } from "@/lib/validators/application";
> // on submit:
> //   parsed = applicationEmailSchema.safeParse(email);
> //   if !parsed.success → set error to parsed.error.issues[0]?.message
> //   else router.push(`/apply?email=${encodeURIComponent(parsed.data)}`)
> ```
> Errors render inline in mono caps with a coral-ish tone.
>
> **Props.** `Hero` takes `{ applicantCount: number }`. Pass that to `MembershipStamp` as `count`.
>
> **Mark `MembershipStamp` `aria-hidden="true"`** — it's decorative; the count is also conveyed elsewhere in the page.

- [ ] **Step 1: Invoke the `frontend-design:frontend-design` skill with the brief**

Pass the brief verbatim.

- [ ] **Step 2: Verify the output against project conventions**

Conformance checklist:
- [ ] No emoji codepoints
- [ ] No competitor brand names
- [ ] Colors use Tailwind tokens where possible (the editorial-brutalist palette uses ink/cream/accent — those should be tokens)
- [ ] Email validation imports `applicationEmailSchema` — does NOT redeclare it
- [ ] `Hero` is client (`"use client"`); `MembershipStamp` is a pure server-renderable function (no hooks)
- [ ] Headline, subline, button, microcopy, and stamp text reproduced verbatim
- [ ] All four spec cells in the transformation split use the exact labels/values from the brief

- [ ] **Step 3: Write the files at the target paths**

- `src/components/marketing/MembershipStamp.tsx`
- `src/components/marketing/Hero.tsx`

- [ ] **Step 4: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/Hero.tsx src/components/marketing/MembershipStamp.tsx
git commit -m "feat(marketing): add hero with email CTA and transformation split"
```

### Task 15: HowItWorks component

**Files:**
- Create: `src/components/marketing/HowItWorks.tsx`

**Design brief (pass verbatim to the `frontend-design:frontend-design` skill):**

> Build the "How it works" 3-step strip that sits directly below the hero on `/`.
>
> **Aesthetic.** Editorial-brutalist. CREAM background (`#f5f1e8`), INK text (`#0a0a0a`). Hard 2px borders top/bottom on the section + on the inner 3-column grid. Mono caps for the step number, serif for the step title, sans for the body. The third step's number is rendered in ACCENT CORAL (`#ff5e3a`) to signal completion. Other step numbers are ink at ~40% opacity. No emoji. No competitor brand names. Use Tailwind tokens.
>
> **Layout.**
> - Section spans full width, has `border-y-2` outer borders
> - Inside, a max-width-1200 container holds a 3-column grid (single column on mobile) wrapped in another `border-2`
> - Each cell has internal padding ~32px (`p-8`)
> - Borders between cells: right border on cells 1 and 2 on desktop, bottom border on cells 1 and 2 on mobile
> - Below the grid, centered, a scroll cue link to `#sample-trip` in mono caps, low opacity
>
> **EXACT copy — verbatim, including line breaks:**
>
> Step 01:
> - Number: `01` (ink at 40% opacity)
> - Title: `Apply for an invite.`
> - Body (single paragraph): `One email. Three quick questions on the next screen. We approve in batches.`
>
> Step 02:
> - Number: `02` (ink at 40% opacity)
> - Title: `Lock the trip with your crew.`
> - Body (single paragraph): `Pick a city, lock the dates, pull the people in. The AI drafts the plan; the crew votes on what stays.`
>
> Step 03:
> - Number: `03` (ACCENT CORAL — this is the only place coral appears in this section)
> - Title: `Enjoy your trip.`
> - Body — TWO SEPARATE PARAGRAPHS, render with a deliberate paragraph break between them:
>   - Para 1: `Bookings handled. Ledger settled.`
>   - Para 2: `Time to make memories.`
>
> Scroll cue link (centered, below the grid): `↓ See a sample trip` — link to `#sample-trip`
>
> **Component shape.** Pure server-renderable function (no hooks, no state). One exported component: `HowItWorks`. No props.

- [ ] **Step 1: Invoke the `frontend-design:frontend-design` skill with the brief**

Pass the brief verbatim.

- [ ] **Step 2: Verify the output against project conventions**

Conformance checklist:
- [ ] No emoji (the `↓` is a Unicode arrow, not an emoji codepoint — verify it's the regular arrow `↓`, not an emoji-rendered version)
- [ ] No competitor brand names
- [ ] Tailwind tokens for colors
- [ ] Step 03's body renders as TWO paragraphs (not joined)
- [ ] Step 03's number is the only coral element in this section
- [ ] Server component (no `"use client"`)
- [ ] Headings use `font-serif`, labels use `font-mono uppercase`

- [ ] **Step 3: Write the file**

`src/components/marketing/HowItWorks.tsx`

- [ ] **Step 4: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/HowItWorks.tsx
git commit -m "feat(marketing): add how-it-works strip"
```

### Task 16: SampleTripTile component

**Files:**
- Create: `src/components/marketing/SampleTripTile.tsx`

**Design brief (pass verbatim to the `frontend-design:frontend-design` skill):**

> Build the inline sample-trip tile section that lives at `id="sample-trip"` on the landing page. It previews a real Lisbon trip and links through to the full `/sample-trip/lisbon` page.
>
> **Aesthetic.** Editorial-brutalist on INK-DARK background (`#0a0a0a`), CREAM text (`#f5f1e8`). The inline tile has its own 2px cream border. Mono caps for labels, serif for the trip name. Accent coral (`#ff5e3a`) on the schedule row left-borders. A polaroid stack in the right column on desktop only (hidden on mobile). No emoji. No competitor brand names. Tailwind tokens.
>
> **Layout.**
> - Section: full-width, ink background, `id="sample-trip"`
> - Header (max-width 1200, before the tile): mono-cap eyebrow + serif h2
> - Tile: max-width 1200, `border-2` cream-at-30%, padding 32-48px
> - Tile inner: 2-column grid `md:grid-cols-[1.4fr_1fr]`, left = trip details, right = polaroid stack (md+ only)
> - Tile left column has, in order: trip header (h3 + mono-cap subline), 4-cell spec grid, schedule list (3 rows + 1 "more days" row)
> - Tile footer: mono-cap microcopy on the left, dark-on-cream CTA on the right (or stacked on mobile)
>
> **EXACT copy — verbatim:**
>
> Section eyebrow: `See what the AI actually produces`
> Section h2: `A real trip. Real budget. Real plan. Six friends. Lisbon. Six days.`
>
> Trip name: `Lisbon` (serif, ~56px)
> Trip subline: `Jun 14 — Jun 19 · 6 days · Foodie + Wine` (mono caps)
>
> Spec grid cells (label / value):
> - `Per head` / `£820`
> - `Crew` / `6`
> - `From` / `LHR`
> - `Vibes` / `Foodie · Wine`
>
> Schedule rows (each gets a coral left-border, 4px padding-left):
> - Day 1 · Time Out Market — `Drop bags at the apartment in Príncipe Real. Walk down to Cais do Sodré.`
> - Day 2 · Belém Tower + Pastéis de Belém — `Tram 15 from Praça do Comércio. Custards before the queue builds.`
> - Day 3 · Sintra day trip — `Train from Rossio. Pena Palace booked for 11. Cabo da Roca on the way back.`
>
> "More days" row (mono caps, low opacity, no border): `3 more days · in the full plan`
>
> Footer microcopy: `Shareable · group-chat-ready`
> Footer CTA (cream button, ink text): `Explore the full trip →` → links to `/sample-trip/lisbon` via Next `<Link>`
>
> **Polaroid stack** (right column, desktop only): three overlapping cream-bg "polaroid" cards, each ~260×320 with slight rotations (`-rotate-[5deg]`, `rotate-[3deg]`, `-rotate-[2deg]`). Each polaroid has an empty dark image area (no real images yet — the Phase 4 surface is copy-only) and a mono-cap caption underneath:
> - `Time Out Market`
> - `Pastéis de Belém`
> - `Pena Palace`
>
> Stack vertically with `top: i * 40px` and increasing `z-index` so they overlap. Mark the empty image areas `aria-hidden="true"`.
>
> **Component shape.** Server component, no hooks, no state. One default-export `SampleTripTile`. Use `next/link` for the CTA.

- [ ] **Step 1: Invoke the `frontend-design:frontend-design` skill with the brief**

Pass the brief verbatim.

- [ ] **Step 2: Verify the output against project conventions**

Conformance checklist:
- [ ] No emoji codepoints (the `→` and `·` are punctuation, fine)
- [ ] No competitor brand names
- [ ] Tailwind tokens used
- [ ] Server component
- [ ] Polaroid stack hidden on mobile (`hidden md:block`)
- [ ] All schedule rows render with their EXACT note text
- [ ] CTA uses `next/link`, not a plain `<a>`

- [ ] **Step 3: Write the file**

`src/components/marketing/SampleTripTile.tsx`

- [ ] **Step 4: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/SampleTripTile.tsx
git commit -m "feat(marketing): add inline sample-trip tile"
```

### Task 17: PricingReveal component

**Files:**
- Create: `src/components/marketing/PricingReveal.tsx`
- Create: `src/lib/pricing/foundingCount.ts`

- [ ] **Step 1: Implement the founding-count helper (no design needed)**

```ts
// src/lib/pricing/foundingCount.ts
import { createServiceClient } from "@/lib/supabase/server";

export const FOUNDING_CREW_LIMIT = 500;

export async function getFoundingCrewRemaining(): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .not("founding_crew_at", "is", null);
  const taken = count ?? 0;
  return Math.max(0, FOUNDING_CREW_LIMIT - taken);
}
```

**Design brief for the `PricingReveal` component (pass verbatim to the `frontend-design:frontend-design` skill):**

> Build a three-tier pricing reveal section. Lives near the bottom of the landing page on `/`. Three tiers, varying visual weights — Free is the quietest, Crew Plus is the obvious-choice middle, Founding Crew is the inner-circle.
>
> **Aesthetic.** Editorial-brutalist. Section background CREAM (`#f5f1e8`), top border 2px ink. Three tier columns inside a `border-2` ink container with hard borders between columns. Each column has a different background treatment (see "Visual hierarchy"). Mono caps for tier name, serif for price, sans for descriptions and bullets. Accent coral (`#ff5e3a`) used for the ribbon on Crew Plus and the counter + left-border on Founding Crew. No emoji. No competitor brand names. Tailwind tokens.
>
> **Visual hierarchy** (left → right):
> - **Free**: cream background, ink text. Reads as the on-ramp.
> - **Crew Plus**: dark grey background (`#1a1a1a`), cream text. Ribbon top-right in coral with text `← Most crews pick`. Reads as the middle, the obvious pick.
> - **Founding Crew**: full ink-black background (`#0a0a0a`), cream text, 4px coral left border. Counter top-right in coral mono caps: `<remaining> / 500 left`. Reads as the inner circle.
>
> **Header** (above the grid):
> - Mono-cap eyebrow: `Pricing`
> - Serif h2 (max-width 640): `Three tiers. One price-lock. Pick the one that gets your crew there.`
>
> **Per-card structure** (vertical inside `p-8`):
> 1. Mono-cap tier name
> 2. Serif price (~32px)
> 3. Mono-cap period subline
> 4. Serif tagline (~20px)
> 5. Sans description (1-2 lines, slightly muted)
> 6. Bullet list — each bullet is a sans line prefixed by a mono `→` arrow, NOT a bullet character or emoji
>
> **EXACT copy — verbatim, including punctuation:**
>
> Free:
> - Name: `Free`
> - Price: `£0`
> - Period: `forever`
> - Tagline: `Try it.`
> - Description: `See your invited trips.` and `Get the AI summary draft.`
> - Bullets:
>   - `Summary AI overview`
>   - `View crew trips you're invited to`
>   - `Crew chat + photos`
>
> Crew Plus:
> - Name: `Crew Plus`
> - Price: `£9 / month`
> - Period: `£79 / yr · save 27%`
> - Ribbon: `Most crews pick` (rendered as `← Most crews pick`)
> - Tagline: `AI plans your trip.`
> - Description: `One admin pays;` and `the whole crew gets in.`
> - Bullets (preserve straight quotes around `who has the link?`):
>   - `AI plans the whole trip — the trip actually happens`
>   - `One admin pays — Pro covers the whole crew`
>   - `Bookings in one place — no more "who has the link?"`
>   - `Money sorted in-trip — one less app to juggle`
>   - `A chat just for this trip — not another group to mute`
>   - `Real flight prices, refreshed on demand`
>
> Founding Crew:
> - Name: `Founding Crew`
> - Price: `£179 / year`
> - Period: `price locked for life`
> - Counter: `<remaining> / 500 left` (top-right of card, mono coral)
> - Tagline: `Your AI travel concierge.`
> - Description: `Dream trips, zero effort.` and `Founding members shape the product.`
> - Bullets:
>   - `Everything in Crew Plus`
>   - `Plan by talking — conversational AI, no more forms`
>   - `Each new trip starts smarter — AI learns your crew`
>   - `Watching for you — flights, events, opportunities`
>   - `During-trip AI — ask anywhere, anytime`
>   - `A real memory book — auto-built when the trip ends`
>   - `Shape the roadmap — your votes pick what ships next`
>   - `Founder badge · founders wall · grandfathered for life`
>
> **Component shape.** Server component, takes `{ foundingRemaining: number }` and renders the live counter. No client-side state. Use a single internal `PricingCard` helper to render each column.

- [ ] **Step 2: Invoke the `frontend-design:frontend-design` skill with the brief**

Pass the brief verbatim.

- [ ] **Step 3: Verify the output against project conventions**

Conformance checklist:
- [ ] No emoji (the `→`, `·`, `←` are punctuation; verify they're not emoji-rendered)
- [ ] No competitor brand names
- [ ] Tailwind tokens for colors
- [ ] Server component (no `"use client"`)
- [ ] Bullets use a mono `→` arrow span, NOT `<li>` default bullets
- [ ] All three tiers' bullets reproduced verbatim, including the curly-vs-straight quotes specified in the brief
- [ ] Ribbon and counter rendered as overlay elements on their cards (not inline)

- [ ] **Step 4: Write the files**

- `src/lib/pricing/foundingCount.ts` (from Step 1)
- `src/components/marketing/PricingReveal.tsx` (skill output)

- [ ] **Step 5: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/PricingReveal.tsx src/lib/pricing/foundingCount.ts
git commit -m "feat(marketing): add three-tier pricing reveal"
```

### Task 18: Compose the public landing page

**Files:**
- Create: `src/app/(public)/page.tsx`

- [ ] **Step 1: Build the page**

```tsx
// src/app/(public)/page.tsx
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { SampleTripTile } from "@/components/marketing/SampleTripTile";
import { PricingReveal } from "@/components/marketing/PricingReveal";
import { getApplicationCount } from "@/lib/actions/applications";
import { getFoundingCrewRemaining } from "@/lib/pricing/foundingCount";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [applicantCount, foundingRemaining] = await Promise.all([
    getApplicationCount(),
    getFoundingCrewRemaining(),
  ]);

  return (
    <main>
      <Hero applicantCount={applicantCount} />
      <HowItWorks />
      <SampleTripTile />
      <PricingReveal foundingRemaining={foundingRemaining} />
      <Footer />
    </main>
  );
}

function Footer() {
  return (
    <footer className="bg-[#0a0a0a] text-[#f5f1e8] px-7 py-12 border-t-2 border-[#f5f1e8]/20">
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#f5f1e8]/60">
          Tripcrew · Invite only
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#f5f1e8]/60">
          Have an invite?{" "}
          <a href="/sign-in" className="underline-offset-4 hover:underline">
            Enter →
          </a>
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Run dev and verify visually**

Run: `pnpm dev`. Sign out. Visit `/`.
Expected: hero with stamp, how-it-works strip, sample trip, three-tier pricing, footer all render. Scroll cue takes you to `#sample-trip` anchor.

- [ ] **Step 3: Verify the authed redirect still works**

Sign in. Visit `/`. Expected: redirected to `/dashboard`.

- [ ] **Step 4: Run the application e2e**

Run: `pnpm test -- tests/applications-flow.spec.ts`
Expected: passes (the form path is now reachable).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(public\)/page.tsx
git commit -m "feat(public): compose landing page from marketing blocks"
```

### Phase 4 closeout — simplify + code-review

- [ ] **Step 1: Identify the files changed in this phase**

Run: `git log -7 --name-only --pretty=format: | sort -u | grep -v '^$'`
Expected: the seven Phase 4 commits cover the dashboard rename, `(public)/layout.tsx`, the four marketing components, the pricing-counter helper, and the landing page composition.

- [ ] **Step 2: Invoke the `simplify` skill**

Use the Skill tool with `skill: "simplify"`. Brief:

> Review the marketing components and public layout from Phase 4. Look for: (a) duplicated section structure that could compose around a shared `MarketingSection` primitive; (b) hex codes that should be moved to Tailwind tokens in `src/app/globals.css` under `@theme`; (c) any place where the same copy appears in two components (the spec's exact strings should each have one home); (d) `useTransition` hooks where a plain `Promise` would suffice. Do NOT introduce new primitives just to remove minor duplication — the editorial-brutalist baseline tolerates repeated borders/typography on purpose.

- [ ] **Step 3: Invoke the `code-review:code-review` skill**

Use the Skill tool with `skill: "code-review:code-review"`. Brief:

> Review Phase 4 commits. Critical checks: (a) middleware does not redirect server actions (`isServerAction` guard preserved); (b) authed users hitting `/` redirect to `/dashboard` and never see the marketing page; (c) `(public)` route group is fully exempt from auth; (d) all dashboard-internal `href="/"` references migrated to `href="/dashboard"` (grep to confirm); (e) hero email validation uses the same Zod schema as the server action (no drift); (f) no emoji codepoints, no competitor brand names. Run `pnpm test -- tests/applications-flow.spec.ts` — must pass now.

- [ ] **Step 4: Run the test suite + content guards**

Run: `pnpm exec vitest run && pnpm test -- tests/applications-flow.spec.ts`
Expected: all tests pass.

Run: `grep -RE "Splitwise|WhatsApp|Google Flights" src/app/\(public\) src/components/marketing 2>/dev/null`
Expected: no matches.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(phase 4): apply simplify + code-review feedback"
```

Skip if no changes were needed.

---

**Phase 4 ship-ready check:** Unauthed visitors can land on `/`, read all six blocks, and submit the application. Authed users go straight to `/dashboard`. The sample-trip CTA links to a 404 still — Phase 5 fixes that.

---

## Phase 5: Shared TripPreview + sample trip + invite-link rewrite

Goal of phase: a single `TripPreview` server component renders both `/sample-trip/lisbon` and the new public `/join/[token]`. Privacy scope is enforced (last 3 days locked, no ledger/bookings, crew first names only).

### Task 19: TripPreview server component (read-only renderer)

**Files:**
- Create: `src/components/trips/TripPreview.tsx`

This is the most important shared UI component in the feature — it powers `/sample-trip/[slug]` and the rewritten `/join/[token]`. Build it once, ship two surfaces.

**Design brief (pass verbatim to the `frontend-design:frontend-design` skill):**

> Build `TripPreview` — a shared, read-only renderer for a trip's hero, spec grid, and partial schedule. Two variants: `"sample"` (renders a `SAMPLE TRIP · <slug>` ribbon) and `"invite"` (renders an inviter strip top, crew counter + CTA bottom).
>
> **Aesthetic.** Editorial-brutalist. INK-DARK background (`#0a0a0a`), CREAM text (`#f5f1e8`). Sample variant overlays a coral-bordered ribbon top-right at a slight rotation. Invite variant overlays a cream-on-ink inviter strip across the top. Mono caps for labels and microcopy, serif huge for the city name. Accent coral on schedule row left-borders and on the invite CTA. Dashed border on the locked-days row. No emoji, no padlock icons (the dashed border carries the locked signal). No competitor brand names. Tailwind tokens.
>
> **Component API:**
>
> ```ts
> export type TripPreviewVariant =
>   | { kind: "sample"; ribbonLabel: string }
>   | {
>       kind: "invite";
>       inviterName: string;
>       inviterAvatarUrl: string | null;
>       crewMembers: { name: string; initials: string }[];
>       ctaHref: string;
>     };
>
> export type TripPreviewSchedule = {
>   day: string;
>   place: string;
>   note: string;
> }[];
>
> export type TripPreviewProps = {
>   trip: Pick<
>     import("@/lib/types").Trip,
>     "hero_title" | "city_label" | "dates_label" | "target_budget_pp" | "currency"
>   > & {
>     crew_size: number;
>     origin: string;
>     vibes: string;
>   };
>   schedule: TripPreviewSchedule;
>   totalDays: number;
>   visibleDays: number;
>   variant: TripPreviewVariant;
> };
> ```
>
> Pure server component, no hooks, no `"use client"`.
>
> **Layout** (in source order, vertical):
>
> 1. **Variant overlay**:
>    - `sample`: ribbon top-right, `border-2 border-[coral]`, mono caps, slight rotation, text = `variant.ribbonLabel`
>    - `invite`: inviter strip top of section (full-width, cream bg, ink text), see below
> 2. **Hero header** (max-width 960, centered horizontally): serif huge city name (~64-96px) — use `trip.city_label ?? trip.hero_title`. Mono-cap subline below: `<dates_label> · <totalDays> days`.
> 3. **Spec grid** — 4 cells, `border-2 border-cream/30`. Mono-cap label, serif value:
>    - `Per head` / `<currencySymbol><target_budget_pp formatted with toLocaleString("en-GB")>` (currency: GBP→£, EUR→€, else $)
>    - `Crew` / `<crew_size>`
>    - `From` / `<origin>`
>    - `Vibes` / `<vibes>`
> 4. **Schedule section** — mono-cap eyebrow `Schedule`. Renders the first `visibleDays` rows of the schedule. Each row: coral `border-l-2`, mono-cap title `<day> · <place>`, sans note `<note>` at ~85% opacity.
> 5. **Locked-days row** (only if `totalDays - visibleDays > 0`): `border border-dashed border-cream/40`, mono caps, low opacity, text: `<lockedDays> more days · unlock when you join`
> 6. **Crew counter section** (invite variant only) — see below
>
> **Inviter strip (invite variant only)** — full-width bar across top of the article, CREAM background, INK text:
> - Left: 40×40 round avatar (image if `inviterAvatarUrl` provided, else first 2 initials of `inviterName` on ink-bg circle), then text:
>   - Sans line with `<strong>{inviterName}</strong> invited you to a trip.`
>   - Mono-cap subline: `Skip the queue · invite-only access granted`
> - Right: a `border-2` ink-on-cream pill: mono caps `Crew invite`
>
> **Crew counter section (invite variant only)**, below the schedule:
> - Mono-cap eyebrow: `<members.length> locked in · you're the <members.length + 1>th`
> - Horizontal flex of crew avatars: each is a 56×56 cream circle showing initials in mono, with first name beneath in mono caps. Then a final dashed-border circle for the invitee with text `you` inside and label below: `you'd make <members.length + 1>`.
> - Coral CTA button (left-aligned, mono caps): `I'm in →` linking to `variant.ctaHref` via plain `<a>` (post-CTA Supabase auth flow needs a full navigation, not Next routing)
> - Mono-cap microcopy: `10 sec to join · pro is covered by <inviterName>`
> - Italic sans footer: `Not for you? Just close the tab. <inviterName> won't see who didn't accept.`
>
> **Privacy.** This component renders ONLY the trip hero, spec grid, partial schedule, crew first names + initials. It does NOT render bookings, ledger, expense data, full names, or chat — those are private. The brief is the surface contract for both `/sample-trip/[slug]` and `/join/[token]`; if either consumer wants more, they wrap, not extend.
>
> **Variant exhaustiveness.** Use TypeScript discriminated-union narrowing on `variant.kind` so the compiler enforces both branches are handled; use a default `never` check if the skill includes one.

- [ ] **Step 1: Invoke the `frontend-design:frontend-design` skill with the brief**

Pass the brief verbatim.

- [ ] **Step 2: Verify the output against project conventions**

Conformance checklist:
- [ ] No emoji, no padlock icons
- [ ] No competitor brand names
- [ ] Tailwind tokens for colors
- [ ] Server component (no `"use client"`, no hooks)
- [ ] Discriminated-union narrowing on `variant.kind`; both branches handled
- [ ] Privacy: no ledger, bookings, full names, or chat references in the component
- [ ] Currency symbol mapping: GBP→£, EUR→€, otherwise $
- [ ] All copy reproduced verbatim — especially the dashed-border locked-days line, the crew counter eyebrow, the CTA button text `I'm in →`, the microcopy `10 sec to join · pro is covered by <inviterName>`, and the footer line about closing the tab

- [ ] **Step 3: Write the file**

`src/components/trips/TripPreview.tsx`

- [ ] **Step 4: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/trips/TripPreview.tsx
git commit -m "feat(preview): add shared TripPreview for sample + invite flows"
```

### Task 20: Sample-trip seed migration

A real Lisbon trip needs to exist in the database for `/sample-trip/lisbon` to render via the production trip-overview components (per spec). For v1 we use TripPreview rather than the full overview, so the seed is minimal — but we still want a real row so the URL is shareable and the slug is real.

**Files:**
- Create: `supabase/migrations/20260429000300_sample_trip_seed.sql`

- [ ] **Step 1: Write the seed migration**

```sql
-- 20260429000300_sample_trip_seed.sql
-- Seed the public Lisbon sample trip. Idempotent via on conflict.
-- The trip has no real members; it is rendered statically by
-- /sample-trip/lisbon via the TripPreview component.

insert into trips (
  slug,
  status,
  hero_title,
  hero_subtitle,
  city_label,
  dates_label,
  target_budget_pp,
  target_crew_size,
  currency,
  meta
) values (
  'lisbon',
  'locked',
  'Lisbon',
  'Six friends. Six days. June.',
  'Lisbon',
  'Jun 14 — Jun 19',
  820,
  6,
  'GBP',
  jsonb_build_object(
    'is_sample', true,
    'origin', 'LHR',
    'vibes', 'Foodie · Wine'
  )
)
on conflict (slug) do update set
  hero_title = excluded.hero_title,
  hero_subtitle = excluded.hero_subtitle,
  city_label = excluded.city_label,
  dates_label = excluded.dates_label,
  target_budget_pp = excluded.target_budget_pp,
  target_crew_size = excluded.target_crew_size,
  currency = excluded.currency,
  meta = excluded.meta;
```

- [ ] **Step 2: Apply and verify**

Run: `pnpm supabase db reset`.
Expected: row exists. `select slug, hero_title from trips where slug = 'lisbon'` returns one row.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260429000300_sample_trip_seed.sql
git commit -m "feat(db): seed Lisbon sample trip for public preview"
```

### Task 21: `/sample-trip/[slug]` route

**Files:**
- Create: `src/app/(public)/sample-trip/[slug]/page.tsx`

- [ ] **Step 1: Build the page**

```tsx
// src/app/(public)/sample-trip/[slug]/page.tsx
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import {
  TripPreview,
  type TripPreviewSchedule,
} from "@/components/trips/TripPreview";

export const dynamic = "force-dynamic";

const LISBON_SCHEDULE: TripPreviewSchedule = [
  {
    day: "Day 1",
    place: "Time Out Market",
    note: "Drop bags at the apartment in Príncipe Real. Walk down to Cais do Sodré for arrival drinks.",
  },
  {
    day: "Day 2",
    place: "Belém + Pastéis de Belém",
    note: "Tram 15 from Praça do Comércio. Pastéis before the queue builds, then the Maritime Museum.",
  },
  {
    day: "Day 3",
    place: "Sintra day trip",
    note: "Train from Rossio. Pena Palace booked for 11. Cabo da Roca on the way back, sunset in Cascais.",
  },
];

export default async function SampleTripPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createServiceClient();
  const { data: trip } = await supabase
    .from("trips")
    .select(
      "hero_title, city_label, dates_label, target_budget_pp, currency, target_crew_size, meta",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!trip) notFound();

  const meta = (trip.meta ?? {}) as { origin?: string; vibes?: string };

  return (
    <TripPreview
      trip={{
        hero_title: trip.hero_title,
        city_label: trip.city_label,
        dates_label: trip.dates_label,
        target_budget_pp: trip.target_budget_pp,
        currency: trip.currency,
        crew_size: trip.target_crew_size ?? 6,
        origin: meta.origin ?? "LHR",
        vibes: meta.vibes ?? "Foodie · Wine",
      }}
      schedule={LISBON_SCHEDULE}
      totalDays={6}
      visibleDays={3}
      variant={{ kind: "sample", ribbonLabel: `Sample trip · ${slug}` }}
    />
  );
}
```

- [ ] **Step 2: Verify visually**

Run: `pnpm dev`. While signed out, visit `/sample-trip/lisbon`.
Expected: the dark preview renders with the ribbon top-right, hero `Lisbon`, the 4 spec cells, 3 schedule rows, and a `3 more days · unlock when you join` row.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(public\)/sample-trip/\[slug\]/page.tsx
git commit -m "feat(sample-trip): add public read-only sample trip route"
```

### Task 22: Rewrite `/join/[token]` to use TripPreview

The current `lookupInvite` returns `{ kind, tripId, tripName, tripSlug }` — it doesn't expose the inviter's name. We extend it to also fetch the inviter's profile name so the public preview can render the inviter strip without a second round-trip.

**Files:**
- Modify: `src/lib/actions/acceptInvite.ts:18-47` — extend `lookupInvite` to return `inviterName: string | null`
- Modify: `src/app/join/[token]/page.tsx` — replace the auth-walled view with the public preview

- [ ] **Step 1: Extend `lookupInvite` to include the inviter's name**

Open `src/lib/actions/acceptInvite.ts`. Replace the `lookupInvite` function (lines 18-47) with:

```ts
export async function lookupInvite(token: string): Promise<
  | { kind: "invalid" }
  | { kind: "expired" }
  | {
      kind: "ok";
      tripId: string;
      tripName: string;
      tripSlug: string;
      inviterName: string | null;
    }
> {
  const service = createServiceClient();
  const { data: invite } = await service
    .from("trip_invites")
    .select("id, trip_id, expires_at, invited_by")
    .eq("token", token)
    .maybeSingle<{
      id: string;
      trip_id: string;
      expires_at: string | null;
      invited_by: string | null;
    }>();
  if (!invite) return { kind: "invalid" };
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return { kind: "expired" };
  }

  const { data: trip } = await service
    .from("trips")
    .select("id, name, slug")
    .eq("id", invite.trip_id)
    .maybeSingle<{ id: string; name: string; slug: string }>();
  if (!trip) return { kind: "invalid" };

  let inviterName: string | null = null;
  if (invite.invited_by) {
    const { data: inviter } = await service
      .from("profiles")
      .select("name")
      .eq("id", invite.invited_by)
      .maybeSingle<{ name: string | null }>();
    inviterName = inviter?.name ?? null;
  }

  return {
    kind: "ok",
    tripId: trip.id,
    tripName: trip.name,
    tripSlug: trip.slug,
    inviterName,
  };
}
```

The function signature is additive — existing callers (`acceptInvite`, `acceptAndRedirect`) ignore the new field and keep working.

- [ ] **Step 2: Verify the change typechecks against existing call sites**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. The `acceptInvite` function in the same file references `lookup.tripName`, `lookup.tripId`, `lookup.tripSlug` — all unchanged.

- [ ] **Step 3: Rewrite the join page**

```tsx
// src/app/join/[token]/page.tsx
import {
  acceptAndRedirect,
  lookupInvite,
} from "@/lib/actions/acceptInvite";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  TripPreview,
  type TripPreviewSchedule,
} from "@/components/trips/TripPreview";

export const revalidate = 0;

const FALLBACK_SCHEDULE: TripPreviewSchedule = [
  {
    day: "Day 1",
    place: "Arrival",
    note: "The crew lands. Unpacking, coffee, a slow first walk.",
  },
  {
    day: "Day 2",
    place: "First full day",
    note: "Plan kicks in. AI-drafted, crew-voted.",
  },
  {
    day: "Day 3",
    place: "The big one",
    note: "The day everyone said yes to.",
  },
];

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const lookup = await lookupInvite(token);
  if (lookup.kind !== "ok") {
    return <JoinError kind={lookup.kind} />;
  }

  // Authed user: defer entirely to the existing accept flow. It redirects
  // to /trips/<slug> on success or back to /join/<token> on error, so we
  // never return from this branch.
  if (user) {
    await acceptAndRedirect(token);
  }

  const service = createServiceClient();
  const { data: trip } = await service
    .from("trips")
    .select(
      "id, hero_title, city_label, dates_label, target_budget_pp, currency, target_crew_size, meta, slug",
    )
    .eq("id", lookup.tripId)
    .maybeSingle<{
      id: string;
      hero_title: string | null;
      city_label: string | null;
      dates_label: string | null;
      target_budget_pp: number | null;
      currency: string | null;
      target_crew_size: number | null;
      meta: { origin?: string; vibes?: string } | null;
      slug: string;
    }>();

  if (!trip) {
    return <JoinError kind="trip-missing" />;
  }

  const { data: members } = await service
    .from("trip_members")
    .select("user_id, role, profiles!inner(name)")
    .eq("trip_id", trip.id);

  const crewMembers = (members ?? []).slice(0, 5).map((m) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    const fullName = (profile as { name: string | null } | null)?.name ?? "Crew";
    const initials = fullName
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("");
    return { name: fullName.split(" ")[0], initials };
  });

  const inviter = lookup.inviterName ?? "A friend";
  const meta = trip.meta ?? {};
  const totalDays = inferDays(trip.dates_label) ?? 6;

  return (
    <TripPreview
      trip={{
        hero_title: trip.hero_title,
        city_label: trip.city_label,
        dates_label: trip.dates_label,
        target_budget_pp: trip.target_budget_pp,
        currency: trip.currency,
        crew_size: trip.target_crew_size ?? crewMembers.length + 1,
        origin: meta.origin ?? "LHR",
        vibes: meta.vibes ?? "Crew trip",
      }}
      schedule={FALLBACK_SCHEDULE}
      totalDays={totalDays}
      visibleDays={3}
      variant={{
        kind: "invite",
        inviterName: inviter,
        inviterAvatarUrl: null,
        crewMembers,
        ctaHref: `/sign-in?next=${encodeURIComponent(`/join/${token}`)}`,
      }}
    />
  );
}

function inferDays(label: string | null): number | null {
  if (!label) return null;
  const match = label.match(/(\d+)\s*days?/i);
  return match ? Number(match[1]) : null;
}

function JoinError({ kind }: { kind: string }) {
  const messages: Record<string, { title: string; body: string }> = {
    expired: {
      title: "Invite expired.",
      body: "Ask the inviter for a fresh link.",
    },
    "trip-missing": {
      title: "Trip no longer exists.",
      body: "It may have been deleted by the admin.",
    },
    invalid: { title: "Invite not found.", body: "Double-check the link." },
  };
  const msg = messages[kind] ?? messages.invalid;
  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#0a0a0a] flex items-center justify-center px-7">
      <div className="text-center flex flex-col gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#0a0a0a]/60">
          Crew invite
        </p>
        <h1 className="font-serif text-[36px]">{msg.title}</h1>
        <p className="font-sans text-[15px]">{msg.body}</p>
      </div>
    </div>
  );
}
```

The `TripPreview.trip` type expects `hero_title` etc. as `string | null` (mirrors the database). If the existing `Trip` type narrows them to `string`, widen the `TripPreview` prop type to match. The `Pick<Trip, ...>` in Task 19 already preserves nullability since the DB columns are nullable.

- [ ] **Step 4: Verify visually**

Generate or grab an existing valid invite token (or run `select token from trip_invites limit 1`). Visit `/join/<token>` while signed out.
Expected: dark preview with inviter strip showing the inviter's first name (or "A friend" fallback), trip header, spec grid, 3 schedule rows + dashed locked row, crew counter with avatars + dashed-border `you`, accent CTA, footer line.

While signed in, visit the same URL: existing accept flow runs, you land on `/trips/<slug>`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/acceptInvite.ts src/app/join/\[token\]/page.tsx
git commit -m "feat(join): public preview with CTA-to-auth + inviter name on lookup"
```

### Phase 5 closeout — simplify + code-review

- [ ] **Step 1: Identify the files changed in this phase**

Run: `git log -4 --name-only --pretty=format: | sort -u | grep -v '^$'`
Expected: `src/components/trips/TripPreview.tsx`, the seed migration, `src/app/(public)/sample-trip/[slug]/page.tsx`, `src/app/join/[token]/page.tsx`, and the `lookupInvite` extension in `src/lib/actions/acceptInvite.ts`.

- [ ] **Step 2: Invoke the `simplify` skill**

Use the Skill tool with `skill: "simplify"`. Brief:

> Review `TripPreview` and its two consumers (`/sample-trip/[slug]`, `/join/[token]`). The component is the single shared renderer for both surfaces — verify no duplicated layout markup leaked back into either consumer page. Check the variant union (`{ kind: "sample" } | { kind: "invite" }`) is exhaustively narrowed. Flag any place where the schedule/spec data shape duplicates the existing `Trip` type unnecessarily.

- [ ] **Step 3: Invoke the `code-review:code-review` skill**

Use the Skill tool with `skill: "code-review:code-review"`. Brief:

> Review Phase 5 commits. Critical checks: (a) the privacy scope on `/join/[token]` — last 3 days collapsed, no ledger/bookings, no expense data leaks pre-auth (read the rendered HTML to be sure); (b) `lookupInvite` now returns `inviterName` and existing callers (`acceptInvite`, `acceptAndRedirect`) still typecheck; (c) the authed branch on `/join/[token]` defers to `acceptAndRedirect` and never returns; (d) the Lisbon seed migration is idempotent (`on conflict (slug) do update`); (e) `/sample-trip/lisbon` renders cleanly while signed out — no auth redirect, no 404.

- [ ] **Step 4: Manual verification**

Run: `pnpm dev`. Visit `/sample-trip/lisbon` signed-out — full preview renders. Visit `/join/<valid-token>` signed-out — public preview with inviter strip + crew counter renders.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(phase 5): apply simplify + code-review feedback"
```

Skip if no changes were needed.

---

**Phase 5 ship-ready check:** Three public surfaces exist: `/`, `/sample-trip/lisbon`, `/join/<token>`. URL is shareable. Visitor sees the product without authing. Application can be submitted. Approval flow is still manual via SQL — Phase 6 wires the founder UI.

---

## Phase 6: Admin approval flow

Goal of phase: founder can sign in, see the queue, read each application, approve or reject. Approved applications generate an invite token and trigger a welcome email with magic-link sign-in.

### Task 23: Founder gate helper

**Files:**
- Create: `src/lib/auth/founder.ts`
- Create: `src/lib/auth/__tests__/founder.test.ts`

- [ ] **Step 1: Test the gate**

```ts
// src/lib/auth/__tests__/founder.test.ts
import { describe, expect, it, vi } from "vitest";
import { isFounderProfile } from "../founder";

describe("isFounderProfile", () => {
  it("returns true when profile.is_founder is true", () => {
    expect(isFounderProfile({ id: "u", name: null, is_founder: true })).toBe(true);
  });
  it("returns false when is_founder is missing or false", () => {
    expect(isFounderProfile({ id: "u", name: null, is_founder: false })).toBe(false);
    expect(isFounderProfile(null)).toBe(false);
    expect(isFounderProfile(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm exec vitest run src/lib/auth/__tests__/founder.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/auth/founder.ts
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

type FounderProfile = { id: string; name: string | null; is_founder: boolean } | null | undefined;

export function isFounderProfile(profile: FounderProfile): boolean {
  return !!profile && profile.is_founder === true;
}

export const requireFounder = cache(async (): Promise<{ id: string }> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new FounderForbiddenError();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_founder")
    .eq("id", user.id)
    .maybeSingle<{ id: string; is_founder: boolean }>();

  if (!profile?.is_founder) throw new FounderForbiddenError();
  return { id: profile.id };
});

export class FounderForbiddenError extends Error {
  constructor() {
    super("FOUNDER_FORBIDDEN");
    this.name = "FounderForbiddenError";
  }
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm exec vitest run src/lib/auth/__tests__/founder.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/founder.ts src/lib/auth/__tests__/founder.test.ts
git commit -m "feat(auth): add founder gate helper"
```

### Task 24: Welcome email module

**Files:**
- Create: `src/lib/email/welcomeEmail.ts`
- Create: `src/lib/email/__tests__/welcomeEmail.test.ts`

- [ ] **Step 1: Test the template builder**

```ts
// src/lib/email/__tests__/welcomeEmail.test.ts
import { describe, expect, it } from "vitest";
import { buildWelcomeEmail } from "../welcomeEmail";

describe("buildWelcomeEmail", () => {
  it("mirrors the pain in the opening line", () => {
    const email = buildWelcomeEmail({
      to: "sarah@example.com",
      magicLinkUrl: "https://tripcrew.app/auth/magic?token=x",
      pain: "dates",
    });
    expect(email.subject).toMatch(/in/i);
    expect(email.text).toContain("dates never align");
    expect(email.text).toContain("https://tripcrew.app/auth/magic?token=x");
  });

  it("derives a first name from the email local part", () => {
    const email = buildWelcomeEmail({
      to: "marcus.smith@startup.io",
      magicLinkUrl: "x",
      pain: "money",
    });
    expect(email.subject).toContain("Marcus");
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `pnpm exec vitest run src/lib/email/__tests__/welcomeEmail.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/email/welcomeEmail.ts
import { painEmailOpener } from "@/lib/applications/painCopy";
import type { ApplicationPain } from "@/lib/types";

export type BuildWelcomeEmailInput = {
  to: string;
  magicLinkUrl: string;
  pain: ApplicationPain;
};

export type WelcomeEmail = {
  to: string;
  subject: string;
  text: string;
};

export function buildWelcomeEmail({
  to,
  magicLinkUrl,
  pain,
}: BuildWelcomeEmailInput): WelcomeEmail {
  const firstName = deriveFirstName(to);
  const opener = painEmailOpener(pain);

  return {
    to,
    subject: `You're in, ${firstName}`,
    text: [
      `${opener}`,
      ``,
      `Tap to sign in: ${magicLinkUrl}`,
      ``,
      `One link, one tap. We'll keep your slot warm for 7 days.`,
      ``,
      `— Tripcrew`,
    ].join("\n"),
  };
}

function deriveFirstName(email: string): string {
  const local = email.split("@")[0] ?? "";
  const raw = local.split(/[._-]/)[0] ?? "there";
  if (!raw) return "there";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

export async function sendWelcomeEmail(input: WelcomeEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.WELCOME_EMAIL_FROM ?? "Tripcrew <hello@tripcrew.app>";

  if (!apiKey) {
    console.warn("[welcomeEmail] RESEND_API_KEY missing — skipping send", {
      to: input.to,
    });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[welcomeEmail] Resend send failed", {
      to: input.to,
      status: response.status,
      body,
    });
    throw new Error("welcome email send failed");
  }
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm exec vitest run src/lib/email/__tests__/welcomeEmail.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/welcomeEmail.ts src/lib/email/__tests__/welcomeEmail.test.ts
git commit -m "feat(email): add welcome email template + sender"
```

### Task 25: Approve / reject server actions

**Files:**
- Create: `src/lib/actions/approveApplication.ts`
- Create: `src/lib/actions/rejectApplication.ts`

- [ ] **Step 1: Implement approveApplication**

```ts
// src/lib/actions/approveApplication.ts
"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireFounder, FounderForbiddenError } from "@/lib/auth/founder";
import {
  buildWelcomeEmail,
  sendWelcomeEmail,
} from "@/lib/email/welcomeEmail";
import type { ApplicationPain } from "@/lib/types";

type ApproveResult = { ok: true } | { ok?: false; error: string };

export async function approveApplication(
  applicationId: string,
): Promise<ApproveResult> {
  let founderId: string;
  try {
    const founder = await requireFounder();
    founderId = founder.id;
  } catch (err) {
    if (err instanceof FounderForbiddenError) return { error: "Forbidden." };
    throw err;
  }

  const supabase = createServiceClient();

  const { data: application } = await supabase
    .from("applications")
    .select("id, email, pain, approved_at, rejected_at")
    .eq("id", applicationId)
    .maybeSingle<{
      id: string;
      email: string;
      pain: ApplicationPain;
      approved_at: string | null;
      rejected_at: string | null;
    }>();

  if (!application) return { error: "Application not found." };
  if (application.approved_at) return { error: "Already approved." };
  if (application.rejected_at) return { error: "Application was rejected." };

  const inviteToken = randomUUID();
  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("applications")
    .update({
      approved_at: now,
      approved_by: founderId,
      invite_token: inviteToken,
      invite_sent_at: now,
    })
    .eq("id", applicationId);

  if (updateError) {
    console.error("approveApplication update failed", updateError);
    return { error: "Could not approve. Try again." };
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://tripcrew.app";
  const magicLinkUrl = `${baseUrl}/sign-in?invite=${inviteToken}`;

  try {
    await sendWelcomeEmail(
      buildWelcomeEmail({
        to: application.email,
        magicLinkUrl,
        pain: application.pain,
      }),
    );
  } catch (err) {
    console.error("approveApplication email failed", err);
    // The DB write succeeded; surface the error so the founder retries
    // the email manually rather than re-approving and double-stamping.
    return { error: "Approved but email failed. Resend manually." };
  }

  revalidatePath("/admin/applications/queue");
  revalidatePath(`/admin/applications/${applicationId}`);
  return { ok: true };
}

export async function approveApplicationsBatch(
  ids: string[],
): Promise<{ ok: true; approved: number; failed: number } | { ok?: false; error: string }> {
  try {
    await requireFounder();
  } catch {
    return { error: "Forbidden." };
  }
  let approved = 0;
  let failed = 0;
  for (const id of ids) {
    const result = await approveApplication(id);
    if ("ok" in result && result.ok) approved += 1;
    else failed += 1;
  }
  return { ok: true, approved, failed };
}
```

- [ ] **Step 2: Implement rejectApplication**

```ts
// src/lib/actions/rejectApplication.ts
"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireFounder, FounderForbiddenError } from "@/lib/auth/founder";

type RejectResult = { ok: true } | { ok?: false; error: string };

export async function rejectApplication(
  applicationId: string,
): Promise<RejectResult> {
  let founderId: string;
  try {
    const founder = await requireFounder();
    founderId = founder.id;
  } catch (err) {
    if (err instanceof FounderForbiddenError) return { error: "Forbidden." };
    throw err;
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("applications")
    .update({
      rejected_at: now,
      rejected_by: founderId,
    })
    .eq("id", applicationId)
    .is("approved_at", null);

  if (error) {
    console.error("rejectApplication update failed", error);
    return { error: "Could not reject. Try again." };
  }

  revalidatePath("/admin/applications/queue");
  revalidatePath(`/admin/applications/${applicationId}`);
  return { ok: true };
}

export async function updateAdminNotes(
  applicationId: string,
  notes: string,
): Promise<{ ok: true } | { ok?: false; error: string }> {
  try {
    await requireFounder();
  } catch {
    return { error: "Forbidden." };
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("applications")
    .update({ admin_notes: notes.slice(0, 4000) })
    .eq("id", applicationId);

  if (error) return { error: "Could not save notes." };
  revalidatePath(`/admin/applications/${applicationId}`);
  return { ok: true };
}
```

- [ ] **Step 3: TS compile**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/approveApplication.ts src/lib/actions/rejectApplication.ts
git commit -m "feat(applications): add approve, reject, and notes actions"
```

### Task 26: Queue page with row component

**Files:**
- Create: `src/components/admin/ApplicationRow.tsx`
- Create: `src/app/(app)/admin/applications/queue/page.tsx`

**Design brief (pass verbatim to the `frontend-design:frontend-design` skill):**

> Build the founder-only applications triage queue at `/admin/applications/queue`, plus the per-row `ApplicationRow` client component used inside it.
>
> **Aesthetic.** Editorial-brutalist admin surface. INK-DARK background (`#0a0a0a`), CREAM text (`#f5f1e8`). Mono caps for labels, small data, and filter chips. Serif for the page title. Accent coral (`#ff5e3a`) for the score-bar fill, the active filter chip, and the Approve action border. Hard 1-2px borders. Tabular layout (no card UI). No emoji. No competitor brand names. Tailwind tokens.
>
> **Page layout** (`/admin/applications/queue`):
>
> Top bar:
> - Left: serif h1 `Applications · Queue`
> - Right: mono-cap counter `<pendingCount> pending · <totalCount> total`
>
> Filter chips row (mono caps): `pending`, `approved`, `rejected`, `all`. Active chip has a coral border + coral text; inactive chips have cream-30 border + cream-65 text. Each chip is a plain `<a>` linking to `/admin/applications/queue?filter=<value>`.
>
> Table (full-width):
> - Header row: mono-cap labels `Email`, `Submitted`, `Role`, `Budget`, `Score`, `Actions` (last cell right-aligned)
> - Body: one `ApplicationRow` per decorated application, sorted by score desc
> - Empty state: a single full-row cell with mono-cap `No applications.` text-center
>
> **`ApplicationRow` (client component) layout** — one `<tr>` with cells:
> 1. Email (sans, underlined link to `/admin/applications/<id>`). If row error state, render mono-cap red error below the email.
> 2. Submitted: `timeAgo(created_at)` in mono caps low opacity. Format: `just now` / `<n>h ago` / `<n>d ago`.
> 3. Role: mono caps (raw enum value)
> 4. Budget: mono caps (raw enum value, e.g. `monopoly`)
> 5. Score: a horizontal score bar — flex container, on the left a 1.5px-tall track (cream/10 bg) with a coral fill of `(score / MAX_SCORE) * 100%`, on the right the score in mono caps `<score.toFixed(1)>` (44px wide).
> 6. Actions (right-aligned): two small buttons side by side — `Approve` (coral border + coral text) and `Reject` (cream-30 border + cream-60 text). Both have `disabled:opacity-40` while pending.
>
> **Server logic for the page** (write this out — it's not design, it's data fetching):
>
> ```ts
> import { notFound } from "next/navigation";
> import { requireFounder, FounderForbiddenError } from "@/lib/auth/founder";
> import { createServiceClient } from "@/lib/supabase/server";
> import { scoreApplication, type ScoringInput } from "@/lib/applications/scoring";
> import { ApplicationRow } from "@/components/admin/ApplicationRow";
> import type { Application } from "@/lib/types";
>
> export const dynamic = "force-dynamic";
>
> type QueueFilter = "pending" | "approved" | "rejected" | "all";
> ```
>
> Founder gate: `try { await requireFounder() } catch (err) { if (err instanceof FounderForbiddenError) notFound(); throw err; }` — 404, never 403.
>
> Filter: read `?filter=` from `searchParams`, narrow to one of the 4 enum values, default `"pending"`.
>
> Query:
> ```ts
> let query = supabase
>   .from("applications")
>   .select("id, email, created_at, trips_per_year, role, pain, budget_attitude, approved_at, rejected_at")
>   .order("created_at", { ascending: false });
> if (filter === "pending") query = query.is("approved_at", null).is("rejected_at", null);
> else if (filter === "approved") query = query.not("approved_at", "is", null);
> else if (filter === "rejected") query = query.not("rejected_at", "is", null);
> ```
>
> Decorate each row with a score via `scoreApplication({ trips_per_year, role, budget_attitude })`, then sort descending by score in JS (Postgres can't sort by a JS function). Then run two head-only count queries for `pendingCount` and `totalCount` and pass to the header.
>
> **`ApplicationRow` behaviour.** Imports `approveApplication` from `@/lib/actions/approveApplication`, `rejectApplication` from `@/lib/actions/rejectApplication`, `MAX_SCORE` from `@/lib/applications/scoring`. Uses `useTransition` for the action click, sets local error state on `{ error }` results, calls `onChanged?.()` on success.
>
> Props: `{ application: Pick<Application, "id" | "email" | "created_at" | "role" | "budget_attitude">, score: number, onChanged?: () => void }`. Use `Pick<>` — never spread the full Application into a client component.
>
> **Conventions.** No comments explaining what code does. No `any` — `unknown` and narrow if needed. Use `next/link` for the email cell's link, plain `<a>` for the filter chips (filter chips trigger a full reload, which is fine since filtering is rare).

- [ ] **Step 1: Invoke the `frontend-design:frontend-design` skill with the brief**

Pass the brief verbatim.

- [ ] **Step 2: Verify the output against project conventions**

Conformance checklist:
- [ ] No emoji
- [ ] No competitor brand names
- [ ] Tailwind tokens for colors
- [ ] Founder gate via `notFound()` on `FounderForbiddenError`, NOT a 403 response
- [ ] `ApplicationRow` is a client component (`"use client"`); the page is a server component
- [ ] Score bar is computed from `MAX_SCORE` imported from `@/lib/applications/scoring`, not hard-coded `10`
- [ ] `Pick<Application, ...>` used for the row's prop type — does not pass full Application
- [ ] Sort descending by score in JS after the query
- [ ] Empty state renders the `No applications.` message

- [ ] **Step 3: Write the files**

- `src/components/admin/ApplicationRow.tsx`
- `src/app/(app)/admin/applications/queue/page.tsx`

- [ ] **Step 4: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Verify the gate**

Run: `pnpm dev`. Sign in as a non-founder. Visit `/admin/applications/queue`.
Expected: 404 not-found page (not the queue).

Set `is_founder = true` for your account via SQL (`update profiles set is_founder = true where id = '<your-id>'`), refresh.
Expected: queue renders with submitted applications, sorted by score descending.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/ApplicationRow.tsx src/app/\(app\)/admin/applications/queue/page.tsx
git commit -m "feat(admin): add applications queue with founder gate"
```

### Task 27: Detail page with approve / reject

**Files:**
- Create: `src/components/admin/ApplicationDetail.tsx`
- Create: `src/app/(app)/admin/applications/[id]/page.tsx`
- Create: `src/lib/applications/answerLabels.ts` — shared answer-label maps used by both `ApplicationDetail` and the public `ApplicationForm`

**Design brief (pass verbatim to the `frontend-design:frontend-design` skill):**

> Build the application detail card at `/admin/applications/<id>` — the founder reads the four answers, the computed score, and decides Approve / Reject. Plus the data-fetching server route that mounts it.
>
> **Aesthetic.** Editorial-brutalist admin surface. INK-DARK background (`#0a0a0a`), CREAM text (`#f5f1e8`). Mono-cap labels for question numbers, status, and the score header. Serif for the answer values (~22px). Coral score-bar fill. Coral-on-cream Approve button (filled, not bordered). Cream-bordered Reject button. Sans body text. Hard borders. No emoji. No competitor brand names. Tailwind tokens.
>
> **Page layout** (`/admin/applications/<id>`):
>
> Container: max-width 760, vertical flex gap 40px, ~48px page padding.
>
> Top row (header):
> - Left: mono caps `Application · <email>`
> - Right: mono caps low-opacity `<status> · <timeAgo(created_at)>` where status is `pending`, `approved`, or `rejected` derived from `approved_at` / `rejected_at` columns
>
> Four answer blocks (one per question, vertically stacked):
> - Mono-cap eyebrow: `<number> · <prompt>` (numbers `01`, `02`, `03`, `04`)
> - Serif answer (~22px): the human-readable label looked up from a shared `answerLabels.ts` module
>
> Score block (border-top above):
> - Mono-cap header: `Score · <score.toFixed(1)> / <MAX_SCORE>`
> - 2px-tall horizontal bar: cream/10 background, coral fill of `(score / MAX_SCORE) * 100%`
> - Sans (~14px) explanation line at ~80% opacity (the `scoreExplanation` prop)
>
> Source row (only renders if `utm_source` or `referrer` is set):
> - Mono-cap: `Source · <referrer or "direct"> · UTM: <utm_source>` (UTM segment only when present)
>
> Notes section:
> - Mono-cap label: `Admin notes`
> - Plain `<textarea>` (3 rows, transparent bg, cream-30 border, sans 14px)
> - Small bordered button below: text `Save notes`, switches to `Saved` for 2s after a successful save
>
> Action buttons (only visible when `status === "pending"`):
> - `Approve & send invite` — coral background, ink text, mono caps
> - `Reject` — cream-40 border only, mono caps
> - Both `disabled` while a transition is pending
>
> Error display: above the action buttons, mono-cap red on a single line.
>
> **Imports (shared label maps).** Create `src/lib/applications/answerLabels.ts` exporting:
>
> ```ts
> import type {
>   ApplicationBudgetAttitude,
>   ApplicationPain,
>   ApplicationRole,
>   ApplicationTripsPerYear,
> } from "@/lib/types";
>
> export const TRIPS_PER_YEAR_LABEL: Record<ApplicationTripsPerYear, string> = {
>   "0": "0",
>   "1": "1",
>   "2-3": "2-3",
>   "4+": "4+",
> };
> export const ROLE_LABEL: Record<ApplicationRole, string> = {
>   organiser: "The one who organises it",
>   attendee: "The one who shows up",
>   depends: "Depends on the trip",
> };
> export const PAIN_LABEL: Record<ApplicationPain, string> = {
>   dates: "Dates never align",
>   booking: "Nobody books anything",
>   money: "Money gets weird",
>   plan: "Plan never gets made",
>   chaos: "Trips happen but feel chaotic",
> };
> export const BUDGET_ATTITUDE_LABEL: Record<ApplicationBudgetAttitude, string> = {
>   monopoly: "Treat it like monopoly money",
>   splurge: "Splurge on what matters",
>   count: "Make every pound count",
>   depends: "It depends on the trip",
> };
> ```
>
> Use these in `ApplicationDetail`. The Phase 6 closeout will catch any drift between this module and `ApplicationForm` (Task 9) — if you find duplication when running `simplify`, refactor `ApplicationForm` to import from here too.
>
> **`ApplicationDetail` behaviour.** Client component (`"use client"`). Imports `approveApplication` from `@/lib/actions/approveApplication`, `rejectApplication` and `updateAdminNotes` from `@/lib/actions/rejectApplication`, `MAX_SCORE` from `@/lib/applications/scoring`. Uses `useTransition` for action calls. On success: `router.push("/admin/applications/queue")`. On error: set local error state.
>
> Props: `{ application: Application, score: number, scoreExplanation: string }`.
>
> **Server route layout** (`src/app/(app)/admin/applications/[id]/page.tsx`):
>
> ```ts
> import { notFound } from "next/navigation";
> import { requireFounder, FounderForbiddenError } from "@/lib/auth/founder";
> import { createServiceClient } from "@/lib/supabase/server";
> import { scoreApplication, scoreExplanation } from "@/lib/applications/scoring";
> import { ApplicationDetail } from "@/components/admin/ApplicationDetail";
> import type { Application } from "@/lib/types";
> export const dynamic = "force-dynamic";
> ```
>
> Pattern: founder-gate via `requireFounder()` in try/catch, `notFound()` on `FounderForbiddenError`. Fetch the row via service-role client, `notFound()` if missing. Compute score + explanation server-side. Pass to `ApplicationDetail`.

- [ ] **Step 1: Write the answer-labels module**

Create `src/lib/applications/answerLabels.ts` with the exact content from the brief above.

- [ ] **Step 2: Invoke the `frontend-design:frontend-design` skill with the brief**

Pass the brief verbatim. The skill produces `ApplicationDetail.tsx` and the route page.

- [ ] **Step 3: Verify the output against project conventions**

Conformance checklist:
- [ ] No emoji
- [ ] No competitor brand names
- [ ] Tailwind tokens for colors
- [ ] `ApplicationDetail` is a client component; the route is a server component
- [ ] Founder gate via `notFound()` on `FounderForbiddenError`
- [ ] Score-bar width computed from `MAX_SCORE` import, not hard-coded
- [ ] Action buttons only render when `status === "pending"`
- [ ] Notes textarea calls `updateAdminNotes` and shows transient `Saved` state for 2s
- [ ] Source row only renders when `utm_source` or `referrer` is set
- [ ] All four answer labels resolved via the shared `answerLabels.ts` module — no inline duplication

- [ ] **Step 4: Write the files**

- `src/lib/applications/answerLabels.ts` (from Step 1)
- `src/components/admin/ApplicationDetail.tsx`
- `src/app/(app)/admin/applications/[id]/page.tsx`

- [ ] **Step 5: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Smoke-test approve**

Submit a test application via `/apply`. As founder, navigate to `/admin/applications/queue`, click into the detail page, click `Approve & send invite`.
Expected: row updates with `approved_at`, `invite_token` is set, log shows email send (or `RESEND_API_KEY missing` warning if no key configured). Queue redirect lands you back at the queue with the row no longer in `pending`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/applications/answerLabels.ts src/components/admin/ApplicationDetail.tsx src/app/\(app\)/admin/applications/\[id\]/page.tsx
git commit -m "feat(admin): add application detail with approve/reject actions"
```

### Task 28: Realtime queue updates + topbar bell badge

**Files:**
- Modify: `src/app/(app)/admin/applications/queue/page.tsx` — wrap rows in a client component that subscribes to realtime
- Create: `src/components/admin/QueueRealtime.tsx`
- Modify: `src/app/(app)/layout.tsx` (or wherever the topbar is composed) — add `Applications` link with badge for founders

- [ ] **Step 1: Build the realtime wrapper**

```tsx
// src/components/admin/QueueRealtime.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function QueueRealtime({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("applications:inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "applications" },
        () => {
          setPulse(true);
          router.refresh();
          setTimeout(() => setPulse(false), 2000);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <div className={pulse ? "animate-pulse" : ""}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Wrap the queue page rows**

Edit `src/app/(app)/admin/applications/queue/page.tsx`. Wrap the `<table>` element in `<QueueRealtime>...</QueueRealtime>`. Add the import:

```ts
import { QueueRealtime } from "@/components/admin/QueueRealtime";
```

- [ ] **Step 3: Add topbar Applications link for founders**

Open `src/app/(app)/layout.tsx`. Find where the topbar is rendered. Add a server component that fetches the founder flag + pending count once per request:

```tsx
import { requireFounder, FounderForbiddenError } from "@/lib/auth/founder";
import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";

async function FounderTopbarLink() {
  try {
    await requireFounder();
  } catch (err) {
    if (err instanceof FounderForbiddenError) return null;
    throw err;
  }
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .is("approved_at", null)
    .is("rejected_at", null);
  return (
    <Link
      href="/admin/applications/queue"
      className="font-mono text-[11px] uppercase tracking-[0.22em] flex items-center gap-2"
    >
      Applications
      {(count ?? 0) > 0 && (
        <span className="bg-[#ff5e3a] text-[#0a0a0a] px-2 py-0.5 text-[10px]">
          {count}
        </span>
      )}
    </Link>
  );
}
```

Render `<FounderTopbarLink />` in the topbar's right-side nav cluster.

- [ ] **Step 4: Verify**

Run `pnpm dev` as the founder. Open the queue in one tab. In another tab (signed-out), submit an application via `/apply`. The queue tab pulses and a new row appears within ~1 second.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/QueueRealtime.tsx src/app/\(app\)/admin/applications/queue/page.tsx src/app/\(app\)/layout.tsx
git commit -m "feat(admin): realtime queue updates and founder topbar badge"
```

### Phase 6 closeout — simplify + code-review

- [ ] **Step 1: Identify the files changed in this phase**

Run: `git log -6 --name-only --pretty=format: | sort -u | grep -v '^$'`
Expected: the founder gate, welcome email, two server actions, queue page + row, detail page + card, realtime wrapper, topbar link.

- [ ] **Step 2: Invoke the `simplify` skill**

Use the Skill tool with `skill: "simplify"`. Brief:

> Review the admin approval surfaces. Check: (a) `approveApplication` and `rejectApplication` share the founder-gate boilerplate — extract a single guard helper if duplicated; (b) the answer-label maps in `ApplicationDetail` mirror the option-label maps in `ApplicationForm` — these should share a source so they never drift; (c) the queue + detail components both compute `timeAgo` — pick one home for it; (d) the realtime subscription unsubscribes on unmount.

- [ ] **Step 3: Invoke the `code-review:code-review` skill**

Use the Skill tool with `skill: "code-review:code-review"`. Brief:

> Review Phase 6 commits. Critical checks: (a) `requireFounder` returns 404 (via `notFound()`) for non-founders on every `/admin/applications/*` route — never 403 (404 hides the route's existence); (b) `approveApplication` is idempotent — second click on an already-approved row returns "Already approved", not a duplicate token; (c) the welcome email's magic-link URL works against the existing sign-in flow; (d) realtime channel cleanup on unmount; (e) `updateAdminNotes` clamps input length (4000 chars) and validates the founder gate; (f) topbar badge query is fast (uses the partial index on pending applications, not a full table scan).

- [ ] **Step 4: End-to-end smoke test**

While signed in as the founder: submit an application via `/apply` in another browser, watch the queue update via realtime, approve the row, verify the welcome email is sent (or the `RESEND_API_KEY missing` warning logs), confirm the row moves out of `pending`.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(phase 6): apply simplify + code-review feedback"
```

Skip if no changes were needed.

---

**Phase 6 ship-ready check:** End-to-end approval pipeline works: visitor applies → founder sees realtime row → founder approves → applicant gets a magic-link email and can sign in. Rejection works without an email. Notes persist.

---

## Phase 7: Stripe webhook conversion linkage + canonical pricing doc + Founding Crew counter

Goal of phase: when a user pays, the corresponding application row gets `first_paid_at` stamped. When a user pays for the founding-crew price, `profiles.founding_crew_at` gets stamped, decrementing the live counter. The canonical `docs/pricing.md` is rewritten to describe the new three-tier model so engineers don't have to re-derive the gate matrix and lifecycle from the spec.

### Task 29: Extend Stripe webhook to stamp conversions

The existing webhook (`src/app/api/stripe/webhook/route.ts`) already has a `profileIdForCustomer(customerId)` helper that looks up the profile via `stripe_customer_id` with an email-based fallback. We reuse it for the founding-crew flag and add a parallel email-keyed lookup for `applications.first_paid_at` (applications are keyed by email, since the user_id link is set later when the magic-link sign-in completes).

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts` — extend `applySubscription` to stamp `applications.first_paid_at` and `profiles.founding_crew_at` on `customer.subscription.created`
- Modify: `src/lib/actions/subscription.ts:50` — add `subscription_data.metadata.user_id` for defensiveness (Stripe does not propagate Checkout Session metadata to the resulting Subscription, so this is a separate copy)

- [ ] **Step 1: Add the founding price ID to env config**

Open `.env.local`. Add:

```bash
STRIPE_FOUNDING_PRICE_ID=price_xxx_replace_with_founding_tier_price_id
```

Document the variable in `.env.example` if that file is tracked. The webhook treats this as optional — if unset, the founding-crew stamp is a silent no-op.

- [ ] **Step 2: Propagate user_id onto the Subscription via subscription_data**

Open `src/lib/actions/subscription.ts`. Find the `stripe.checkout.sessions.create` call (line 40). Replace its `subscription_data` line with:

```ts
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: { user_id: user.id },
      },
```

Keep the existing `metadata: { user_id: user.id }` on the session itself — that survives on the Checkout Session for any session-level webhooks.

- [ ] **Step 3: Add a helper to fetch a customer's email**

Open `src/app/api/stripe/webhook/route.ts`. Below the existing `profileIdForCustomer` function, add:

```ts
async function customerEmail(customerId: string): Promise<string | null> {
  try {
    const stripe = getStripe();
    const cust = await stripe.customers.retrieve(customerId);
    if (cust.deleted) return null;
    return cust.email ?? null;
  } catch (err) {
    console.error("stripe webhook: customers.retrieve failed:", err);
    return null;
  }
}
```

- [ ] **Step 4: Extend `applySubscription` to stamp the new columns**

Replace the entire `applySubscription` function with:

```ts
async function applySubscription(
  sub: Stripe.Subscription,
  isCreated: boolean,
): Promise<void> {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const profileId = await profileIdForCustomer(customerId);
  if (!profileId) {
    console.warn(
      `stripe webhook: no profile for customer ${customerId} (sub ${sub.id})`,
    );
    return;
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      stripe_subscription_status: coerceStatus(sub.status),
      current_period_end: periodEndIso(sub),
    })
    .eq("id", profileId);

  if (error) {
    throw new Error(`profiles update failed: ${error.message}`);
  }

  if (!isCreated) return;

  // First paid event for this subscription. Stamp the application row
  // (matched by customer email) and, if this is the founding-crew price,
  // mark the profile.
  const email = await customerEmail(customerId);
  if (email) {
    const { error: stampErr } = await supabase
      .from("applications")
      .update({ first_paid_at: new Date().toISOString() })
      .eq("email", email.toLowerCase())
      .is("first_paid_at", null);
    if (stampErr) {
      console.error(
        "stripe webhook: applications.first_paid_at update failed:",
        stampErr,
      );
    }
  }

  const foundingPriceId = process.env.STRIPE_FOUNDING_PRICE_ID;
  if (foundingPriceId) {
    const priceId = sub.items.data[0]?.price?.id;
    if (priceId === foundingPriceId) {
      const { error: foundingErr } = await supabase
        .from("profiles")
        .update({ founding_crew_at: new Date().toISOString() })
        .eq("id", profileId)
        .is("founding_crew_at", null);
      if (foundingErr) {
        console.error(
          "stripe webhook: founding_crew_at update failed:",
          foundingErr,
        );
      }
    }
  }
}
```

- [ ] **Step 5: Pass the `isCreated` flag from the event router**

In the `switch (event.type)` block (around line 135), update the cases:

```ts
      case "customer.subscription.created":
        await applySubscription(event.data.object as Stripe.Subscription, true);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscription(event.data.object as Stripe.Subscription, false);
        break;
```

The flag matters: `subscription.updated` fires on every renewal and trial-to-paid transition. Stamping `first_paid_at` on those would overwrite the original conversion timestamp. The `is("first_paid_at", null)` guard already prevents that, but the explicit `isCreated` flag also avoids the expensive customer-email + applications scan on routine updates.

- [ ] **Step 6: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual verification with Stripe CLI**

In one terminal: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
In another: complete a checkout against the founding price ID with a Stripe test card. The applicant's email must already exist in `applications`.

Expected logs from the dev server:
1. `customer.subscription.created` arrives.
2. `applications.first_paid_at` row count increments by 1 for that email.
3. If founding price: `profiles.founding_crew_at` is set for that user.

Verify with SQL:

```sql
select email, first_paid_at from applications where email = '<test email>';
select id, founding_crew_at from profiles where id = '<test user id>';
```

Both should be non-null.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts src/lib/actions/subscription.ts
git commit -m "feat(stripe): stamp applications.first_paid_at and founding_crew_at on conversion"
```

### Task 30: Rewrite `docs/pricing.md` for the three-tier model

`docs/pricing.md` is the canonical engineering doc for what the tiers are, who pays for what, what the feature gates are, and how the Stripe lifecycle behaves. It currently describes the old Free + Crew Plus £4.99/mo model. The new three-tier model (Free / Crew Plus £9/mo / Founding Crew £179/yr) supersedes it. The ops sections (team-share, lifecycle states, webhook authoritativeness, founder coupon, test-mode notes) all stay true and must be preserved.

**Files:**
- Modify: `docs/pricing.md` — full rewrite of the tier table, gate matrix, and add a Founding Crew section; preserve lifecycle + ops sections verbatim where unchanged

- [ ] **Step 1: Replace the file with the new structure**

Write `docs/pricing.md` with this content:

```markdown
# Tripcrew pricing & business model

This is the canonical doc for what the tiers are, who pays for them, and what happens at every step of the subscription lifecycle. Anything in CLAUDE.md or other docs that contradicts this file is out of date — fix it here, then propagate.

## What Tripcrew is

Tripcrew is a planning app for group trips. A trip has one or more **admins** (organisers) and any number of **members** (the crew). Every trip moves through `planning` → `locked` → in-flight → wrap-up.

The free tier lets anyone evaluate the product and join trips they're invited to. The paid tiers turn on the AI planning surfaces that scale across the whole crew.

## Pricing

| Plan | Price | Billing |
|---|---|---|
| Free | £0 | — |
| Crew Plus | £9 / month or £79 / year (save 27%) | 7-day free trial, card on file via Stripe Checkout |
| Founding Crew | £179 / year | One-time purchase of a year, then renews. Price-locked for life. Capped at 500 sales. |

Founding Crew is the inner-circle tier — see "Founding Crew" below for the full mechanic.

### Stripe price IDs

| Tier | Env var | Notes |
|---|---|---|
| Crew Plus monthly | `STRIPE_PRICE_ID` | Default fallback in code is the legacy £4.99 price ID; this MUST be flipped to the new £9 price ID before the new landing page goes live (see "Cutover" below). |
| Founding Crew yearly | `STRIPE_FOUNDING_PRICE_ID` | Optional — webhook silently no-ops the founding-crew stamp if unset. |

## Who pays — the team-share model

The deliberately generous bit: **a paying admin pays for the crew**. Concretely, the gate function `hasProAccessForTrip(userId, tripId)` in [src/lib/plan.ts](../src/lib/plan.ts) returns true when **either**:

1. The asking user is on Crew Plus / trial / Founding Crew themselves, **or**
2. **Any admin on that trip** is on Crew Plus / trial / Founding Crew.

This produces three buyer personas:

| Persona | Why they buy |
|---|---|
| **Trip admin / organiser** | Best ROI — your whole crew gets paid features on every trip you organise. The intended primary buyer. |
| **Power member** | A member on multiple trips where the admins haven't subscribed; they pay for personal access across all their trips. Non-admin members can't extend their access to others, only to themselves. |
| **Co-admin freeloader** | Two admins on the same trip — only one needs to pay; the other inherits. Working as intended. |

There's no admin gate on the Subscribe button — anyone can buy a paid tier. The marketing on `/account` and on the public pricing block leans into the team-share angle ("One admin pays — Pro covers the whole crew") because that's the strongest pitch; non-admins still see the same panel but get less leverage out of it.

If you ever want to switch to per-seat / individual-only pricing, change `hasProAccessForTrip` to drop the admin-of-trip check. That's the single load-bearing branch.

## Free vs Crew Plus vs Founding Crew — feature matrix

| Surface | Free | Crew Plus | Founding Crew |
|---|---|---|---|
| Trip creation, crew invites, role management | ✓ | ✓ | ✓ |
| Destination proposals, voting, locking | ✓ | ✓ | ✓ |
| Crew chat (`/feed`) | ✓ | ✓ | ✓ |
| Bookings checklist | ✓ | ✓ | ✓ |
| Ledger / expense splitting | ✓ | ✓ | ✓ |
| Notifications (bell) | ✓ | ✓ | ✓ |
| Lock & draft — narrative plan blob | summary blob only | full enriched plan (weather, hotels, day-by-day, book-ahead, budget) | same as Crew Plus |
| Lock & draft — structured brief (hero, spec grid, schedule, activities, bookings) | not populated | populated atomically | populated atomically |
| Lock & draft — generations per trip | 1 | up to 10, plus regeneration when the brief drifts stale | unlimited |
| Per-shortlisted-candidate basic plans | blocked | available | available |
| Pinned moments (AI anchors the plan around them) | recorded but ignored | honoured | honoured |
| Price refresh button | blocked | available, capped at 1 / 4h | available, no rate limit |
| Conversational AI planning (no forms) | — | — | ✓ — month 1 |
| Cross-trip memory (AI learns your crew over trips) | — | — | ✓ — months 2-3 |
| Live flight monitoring + price-drop alerts | — | — | ✓ — months 2-3 |
| During-trip AI (location-aware queries on mobile) | — | — | ✓ — months 3-4 |
| Event/opportunity alerts during trip | — | — | ✓ — months 3-4 |
| Auto memory book (PDF) | — | — | ✓ — months 5-6 |
| Roadmap voting (founder-tier feature picks) | — | — | ✓ — month 1 |
| Founder badge + founders wall | — | — | ✓ — month 1 |
| Lifetime price-lock | — | — | ✓ — locked at £179/yr forever |
| 30-day early access on every Founding Crew feature | — | — | ✓ |

Source of truth for the gate logic is [src/lib/gates.ts](../src/lib/gates.ts) and [src/lib/plan.ts](../src/lib/plan.ts). A change to the matrix above means a change there too.

## Founding Crew — the inner-circle mechanic

A real concierge tier, not a status play. Capped at **500 lifetime sales**, tracked via `profiles.founding_crew_at` (set on the first `customer.subscription.created` for the founding price ID). The "47 / 500 LEFT" counter on the public landing page is `500 - count(*) where founding_crew_at is not null`.

**Feature ladder over the first 6 months:**

| Month | Feature | Status flag |
|---|---|---|
| Month 1 (launch) | Conversational AI chat, founder badge, founders wall, lifetime price-lock, roadmap voting | ships at launch |
| Months 2-3 | Cross-trip memory, live flight monitoring + price-drop alerts | tracked in `roadmap.md` |
| Months 3-4 | During-trip AI (location-aware queries on mobile), event/opportunity alerts | tracked in `roadmap.md` |
| Months 5-6 | Auto memory book (PDF; printed-and-mailed as a v2 stretch) | tracked in `roadmap.md` |

Founding members get every Founding Crew feature **30 days before** Crew Plus (where the feature crosses tiers).

**Sell-out behaviour.** Once 500 founding-crew sales are recorded, the tier converts to **"Crew Concierge"** at £29/mo or £249/yr for new buyers. Existing Founding Crew members are price-locked at £179/yr forever. The transition is a code change, not an automatic flip — see `roadmap.md` for the cutover playbook.

The £179/yr price is intentionally underpriced for the value. It's the loss leader for evangelism — Founding members are the public face of the product, the people who post screenshots and write referrals. Their lifetime price-lock becomes a real moat over time.

## Lifecycle — what happens at every transition

### Sign up
A new account starts on the **free** tier with no Stripe relationship. `profiles.stripe_subscription_status` is `null`.

### Click "Start 7-day free trial" (Crew Plus)
The `createCheckoutSession` server action ([src/lib/actions/subscription.ts](../src/lib/actions/subscription.ts)) creates a Stripe Checkout session with `subscription_data.trial_period_days: 7` and `allow_promotion_codes: true`. User is redirected to Stripe's hosted Checkout, enters card, and returns to `/account/checkout/success`.

Stripe immediately fires `customer.subscription.created` to our webhook with `status: 'trialing'`. The webhook writes:
- `stripe_customer_id`
- `stripe_subscription_id`
- `stripe_subscription_status: 'trialing'`
- `current_period_end` = trial end (7 days from now)
- `applications.first_paid_at` (matched by customer email) — closes the application → conversion loop.

`get_user_plan(user_id)` returns `'pro'` for both `'trialing'` and `'active'` statuses — the gate doesn't care which phase you're in.

### Click "Buy Founding Crew"
Same `createCheckoutSession` flow but with the founding price ID and **no trial**. On `customer.subscription.created`, the webhook writes the standard subscription columns AND stamps `profiles.founding_crew_at` (decrementing the public counter) AND stamps `applications.first_paid_at`.

### During the trial
User has full Crew Plus access. They can plan one trip end-to-end before the trial ends. That's the value proposition.

### Cancel during trial
User opens Stripe Customer Portal via "Manage subscription", cancels. Stripe marks the subscription `cancel_at_period_end: true` and fires a `customer.subscription.updated` event. Our webhook writes status (still `trialing`) but the `current_period_end` is unchanged. At the trial end, Stripe deletes the subscription and fires `customer.subscription.deleted`; webhook writes `status: 'canceled'`. **Result: no charge, ever.**

### Trial ends without cancellation, with valid card
Stripe charges the Crew Plus price, transitions the subscription to `active`. Webhook writes `status: 'active'` and updates `current_period_end` to one month out. User keeps full access seamlessly.

### Trial ends without cancellation, with payment failure
Stripe transitions subscription to `past_due`. Webhook writes that status. The `/account` panel switches to "Payment needed — last payment failed. Update card to keep Crew Plus." Stripe automatically retries up to 4 times over a few weeks via Smart Retries. If all retries fail, status moves to `canceled`.

### Mid-cycle cancel (during paid period)
User cancels via Customer Portal. Stripe marks `cancel_at_period_end: true`, status stays `active`, `current_period_end` is unchanged. User keeps Crew Plus until the period ends. At period end, Stripe fires `customer.subscription.deleted`; webhook writes `status: 'canceled'`. Panel switches to "Crew Plus ending DD MMM" with a Resubscribe button.

### Founding Crew cancel
Founding members can cancel like any other subscriber. Their `profiles.founding_crew_at` stays set — the price-lock persists if they ever resubscribe within the eligibility window. After full cancellation, they lose Founding Crew features at period end; the founders-wall listing depends on whether the `founding_crew_at` flag stays set (current implementation: yes, the badge is permanent for anyone who ever bought).

### Reactivate
`/account` "Resubscribe" button calls `createCheckoutSession` again. New subscription, new trial **only if** Stripe's eligibility logic allows it (typically once per customer). The same flow runs.

## Operational notes

**The webhook is authoritative.** Anything other than the Stripe → webhook → `profiles` path that writes `stripe_subscription_status` is a hack. The Codex-built migration includes manual SQL flips as a recovery path — those should be rare and documented in the row's update history if used.

**`stripe_customer_id` populates on first webhook.** If a customer is created via Stripe Dashboard (admin manually adding a sub), the webhook still picks it up via the email-fallback lookup ([src/app/api/stripe/webhook/route.ts](../src/app/api/stripe/webhook/route.ts) `profileIdForCustomer`).

**Application-row stamping.** `applications.first_paid_at` is set on the first `customer.subscription.created` for any subscription, by matching the Stripe customer's email to `applications.email` (case-insensitive). Subsequent `subscription.updated` events do not re-stamp.

**Founder coupon `wmc0DTCf`** (100% off, forever) exists in Stripe live mode. Apply via the dashboard for friends-and-family or via a promotion code at checkout (since `allow_promotion_codes: true` is set).

**Test mode locally**: switch `STRIPE_SECRET_KEY` to `sk_test_…`, `STRIPE_PRICE_ID` and `STRIPE_FOUNDING_PRICE_ID` to test-mode prices. Run `stripe listen --forward-to localhost:3000/api/stripe/webhook` for the webhook signing secret. Use card `4242 4242 4242 4242` to simulate a successful trial start.

## Cutover — switching from £4.99 to the new pricing

The £4.99 price ID currently hard-coded as the fallback in [src/lib/actions/subscription.ts](../src/lib/actions/subscription.ts) (`DEFAULT_PRICE_ID`) predates the new three-tier model. Before the public landing page goes live the founder must:

1. **Create new Stripe prices** in the Stripe dashboard:
   - Crew Plus monthly @ £9
   - Crew Plus yearly @ £79
   - Founding Crew yearly @ £179
2. **Set the env vars** in production:
   - `STRIPE_PRICE_ID=<new Crew Plus monthly price id>`
   - `STRIPE_FOUNDING_PRICE_ID=<new Founding Crew yearly price id>`
3. **Verify the cutover** by completing a test purchase against each price ID in test mode and confirming the webhook stamps the right columns.

Existing customers on the £4.99 price stay on £4.99 until they cancel and resubscribe (Stripe doesn't migrate prices automatically). Grandfathering them at the lower rate is a deliberate goodwill choice; if you ever want to forcibly migrate, use Stripe's subscription update API to switch their item price.

## Open questions / tracked debt

- **Annual Crew Plus pricing UI** — backend supports it; the toggle on `/account` between monthly/yearly is not yet built. v1.5.
- **Pause-subscription self-serve** — Stripe Customer Portal can be configured to allow pausing instead of cancelling (configurable in dashboard); enable this when you're comfortable with the feature.
- **Trial extensions / win-back flows** — if churn is high after trial, consider an "extend trial 7 days" lever for users who haven't activated AI features yet.
- **Per-seat/team plans** — if a single trip ever needs Crew Plus on behalf of multiple crews, the team-share model breaks down. Not a current need.
- **Founders-wall surface** — the spec promises a founders wall on Founding Crew. The page exists in the roadmap (`roadmap.md`) but is not yet implemented.
```

- [ ] **Step 2: Verify CLAUDE.md still references this file correctly**

Run: `grep -n "docs/pricing.md" CLAUDE.md`
Expected: one or more references, all of which still resolve. The link target is unchanged.

- [ ] **Step 3: Verify no other docs claim a different price**

Run: `grep -rn "4.99\|4\\.99\|£4" docs/ README.md CLAUDE.md 2>/dev/null | grep -v archive`
Expected: zero hits in non-archived docs. If any surface, update them to refer to `docs/pricing.md` rather than restating the price.

- [ ] **Step 4: Commit**

```bash
git add docs/pricing.md
git commit -m "docs(pricing): rewrite for three-tier model with Founding Crew"
```

### Task 31: Verify the founding-counter decrements live

**Files:** none (verification task)

- [ ] **Step 1: Confirm the counter component reads live**

Open `src/components/marketing/PricingReveal.tsx`. Confirm `foundingRemaining` is rendered as `{foundingRemaining} / 500 left`. Then open `src/app/(public)/page.tsx` and confirm `getFoundingCrewRemaining()` is called with `force-dynamic`.

- [ ] **Step 2: Trigger a founding-tier subscription in test mode**

Use Stripe test cards to complete a checkout against the founding-crew price ID.
Expected: webhook stamps `founding_crew_at`. Reload `/`. The counter shows 499 instead of 500.

- [ ] **Step 3: Commit (no changes — only verification)**

If a small fix was required, commit it:

```bash
git diff --stat
git add <changed-files>
git commit -m "fix(pricing): align founding counter with webhook"
```

If no changes were needed, skip this step.

### Phase 7 closeout — simplify + code-review

- [ ] **Step 1: Identify the files changed in this phase**

Run: `git log -3 --name-only --pretty=format: | sort -u | grep -v '^$'`
Expected: `src/app/api/stripe/webhook/route.ts`, `src/lib/actions/subscription.ts`, `docs/pricing.md`.

- [ ] **Step 2: Invoke the `simplify` skill**

Use the Skill tool with `skill: "simplify"`. Brief:

> Review the Stripe webhook changes. Check: (a) the `customerEmail` helper is the only path that calls `stripe.customers.retrieve` for email — no duplication with `profileIdForCustomer`; (b) the `isCreated` flag is the cleanest way to gate the one-time stamps, vs splitting into two functions; (c) `applications.first_paid_at` is matched case-insensitively (we lowercase on insert and on match). Skip suggestions to refactor `applySubscription` into smaller pieces — the current shape is intentional.

- [ ] **Step 3: Invoke the `code-review:code-review` skill**

Use the Skill tool with `skill: "code-review:code-review"`. Brief:

> Review Phase 7 commits. Critical checks: (a) the webhook signature verification is unchanged — no path bypasses it; (b) `STRIPE_FOUNDING_PRICE_ID` is optional and the founding stamp silently no-ops when unset (no errors thrown); (c) `subscription_data.metadata.user_id` is set on the checkout session creation; (d) `applications.first_paid_at` only fires on `customer.subscription.created`, not on `.updated`; (e) the webhook returns 500 on Supabase update failure so Stripe retries; (f) `docs/pricing.md` rewrite preserves the lifecycle and ops sections from the original — read both side-by-side to confirm; (g) the cutover section flags the £4.99 → £9 price-ID change as a separate manual ops step.

- [ ] **Step 4: Verify pricing.md continuity**

Run: `grep -E "team-share|price-lock|founder coupon|webhook is authoritative" docs/pricing.md`
Expected: at least four matches confirming the operational sections survived the rewrite.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore(phase 7): apply simplify + code-review feedback"
```

Skip if no changes were needed.

---

**Phase 7 ship-ready check:** Funnel is end-to-end: application → approve → sign in → pay → application stamped + founding count decrements.

---

## Phase 8: Analytics dashboard + verification

Goal of phase: founder can read funnel + segment-conversion charts at `/admin/applications`. Final verification covers the no-emoji and no-brand-name guarantees from the spec.

### Task 32: Analytics dashboard page

**Files:**
- Create: `src/app/(app)/admin/applications/page.tsx`

**Design brief (pass verbatim to the `frontend-design:frontend-design` skill):**

> Build the founder-only applications analytics dashboard at `/admin/applications`. Surfaces the funnel and the four segment-conversion tables. Tabular, no charts.
>
> **Aesthetic.** Editorial-brutalist admin surface. INK-DARK background (`#0a0a0a`), CREAM text (`#f5f1e8`). Mono-cap labels, serif for the page title and the big stat numbers. Hard borders. No emoji. No competitor brand names. Tailwind tokens. Tables only — do NOT introduce a charting library, the project's editorial-brutalist baseline uses tables for data.
>
> **Layout** (max-width 1100, gap 48px between blocks):
>
> Header:
> - Mono-cap eyebrow: `Admin`
> - Serif h1: `Applications · Analytics`
>
> Funnel stats (3-column grid inside a `border-2 border-cream/30`):
> - Cell 1: mono-cap label `Submitted`, serif value `<total>`
> - Cell 2: mono-cap label `Approved`, serif value `<approved>`
> - Cell 3: mono-cap label `Paid`, serif value `<paid>`
> - Right border between cells, no border on the last
>
> Four segment tables, stacked vertically. Each has:
> - Mono-cap title above (e.g. `Paid rate by budget`)
> - 4-column table: `Segment`, `Total`, `Paid`, `Rate` (mono caps in header, mono in body)
> - `Rate` column renders `(paid / total) * 100` to one decimal with `%` suffix
> - Empty state: a single row spanning all 4 columns with mono-cap `No data yet.`
>
> Table titles in order:
> 1. `Paid rate by budget`
> 2. `Paid rate by role`
> 3. `Paid rate by pain`
> 4. `Paid rate by source`
>
> **Server logic** (write this out — it's data shape, not design):
>
> ```ts
> import { notFound } from "next/navigation";
> import { requireFounder, FounderForbiddenError } from "@/lib/auth/founder";
> import { createServiceClient } from "@/lib/supabase/server";
> export const dynamic = "force-dynamic";
>
> type SegmentRow = { segment: string; total: number; paid: number; rate: number };
> ```
>
> Founder gate: `try { await requireFounder() } catch (err) { if (err instanceof FounderForbiddenError) notFound(); throw err; }`.
>
> Single query: `select id, role, pain, budget_attitude, approved_at, first_paid_at, utm_source from applications` (no filter — aggregating all rows in JS).
>
> Aggregate helper:
> ```ts
> function aggregate<T extends { first_paid_at: string | null }>(
>   apps: T[],
>   groupBy: (r: T) => string,
> ): SegmentRow[] {
>   const acc = new Map<string, { total: number; paid: number }>();
>   for (const r of apps) {
>     const key = groupBy(r);
>     const prev = acc.get(key) ?? { total: 0, paid: 0 };
>     prev.total += 1;
>     if (r.first_paid_at) prev.paid += 1;
>     acc.set(key, prev);
>   }
>   return [...acc.entries()].map(([segment, { total, paid }]) => ({
>     segment,
>     total,
>     paid,
>     rate: total === 0 ? 0 : paid / total,
>   }));
> }
> ```
>
> Compute `total = apps.length`, `approved = apps.filter(r => r.approved_at).length`, `paid = apps.filter(r => r.first_paid_at).length`.
>
> Build the four segment lists by passing the grouping function: `r => r.budget_attitude`, `r => r.role`, `r => r.pain`, `r => r.utm_source ?? "direct"`.

- [ ] **Step 1: Invoke the `frontend-design:frontend-design` skill with the brief**

Pass the brief verbatim.

- [ ] **Step 2: Verify the output against project conventions**

Conformance checklist:
- [ ] No emoji
- [ ] No competitor brand names
- [ ] Tailwind tokens for colors
- [ ] Server component (no `"use client"`)
- [ ] No charting library imported
- [ ] Founder gate via `notFound()` on `FounderForbiddenError`
- [ ] `aggregate` helper used four times — same function, different `groupBy` argument; not duplicated inline
- [ ] Segment tables render correctly when empty (`No data yet.` row)
- [ ] Rate computation handles `total === 0` without dividing by zero

- [ ] **Step 3: Write the file**

`src/app/(app)/admin/applications/page.tsx`

- [ ] **Step 4: TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Verify the gate and the data**

As a non-founder visit `/admin/applications` — expect 404. As founder, expect the dashboard with three stat cells and four segment tables.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/admin/applications/page.tsx
git commit -m "feat(admin): add applications analytics dashboard"
```

### Task 33: No-emoji + no-brand-name verification + a11y sweep

**Files:**
- Create: `tests/landing-content-guards.spec.ts`

- [ ] **Step 1: Write the verification test**

```ts
// tests/landing-content-guards.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PUBLIC_ROUTES = ["/", "/apply?email=t@t.co", "/sample-trip/lisbon"];

const FORBIDDEN_BRANDS = [
  "Splitwise",
  "WhatsApp",
  "Google Flights",
  "Whatsapp",
  "splitwise",
];

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u;

test.describe("public surfaces — content guards", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} contains no emoji`, async ({ page }) => {
      await page.goto(route);
      const html = await page.content();
      expect(EMOJI_RE.test(html)).toBe(false);
    });

    test(`${route} contains no competitor brand names`, async ({ page }) => {
      await page.goto(route);
      const html = await page.content();
      for (const brand of FORBIDDEN_BRANDS) {
        expect(html, `${route} mentions ${brand}`).not.toContain(brand);
      }
    });

    test(`${route} passes axe a11y sweep`, async ({ page }) => {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: Run the suite**

Run: `pnpm test -- tests/landing-content-guards.spec.ts`
Expected: all tests pass. If a brand name is found, fix the offending copy and re-run; if a11y violations are reported, address them in the failing component.

- [ ] **Step 3: Final smoke pass through the full verification list from the spec**

Manually check, ticking each item:

```
[ ] Anonymous /  shows landing (not sign-in)
[ ] Authed / redirects to /dashboard
[ ] /sample-trip/lisbon renders fully signed-out
[ ] /join/<token> renders public preview signed-out
[ ] Pricing block renders all three tiers; counter reads live
[ ] /admin/applications renders for founder, 404s for non-founder
[ ] /admin/applications/queue lists pending sorted by score
[ ] Submitting via /apply makes a queue row appear in realtime
[ ] Approve & send invite stamps approved_at, generates token, sends email
[ ] Reject stamps rejected_at, no email
[ ] grep rendered HTML for emoji codepoints — zero
[ ] grep rendered HTML for Splitwise / WhatsApp / Google Flights — zero
[ ] roadmap.md is touched in the same PR if any Founding Crew feature shipped
```

- [ ] **Step 4: Commit**

```bash
git add tests/landing-content-guards.spec.ts
git commit -m "test(public): guard against emojis, brand names, a11y violations"
```

### Phase 8 closeout — final review

- [ ] **Step 1: Identify the files changed in this phase**

Run: `git log -2 --name-only --pretty=format: | sort -u | grep -v '^$'`
Expected: `src/app/(app)/admin/applications/page.tsx` and `tests/landing-content-guards.spec.ts`.

- [ ] **Step 2: Invoke the `simplify` skill on the analytics page**

Use the Skill tool with `skill: "simplify"`. Brief:

> Review the analytics dashboard. The `aggregate` helper is invoked four times — verify it's actually shared rather than copied. The `SegmentRow` type is local; if it duplicates anything from `Application`, simplify. Skip suggestions to add charting libraries — the editorial-brutalist aesthetic uses tables, not charts.

- [ ] **Step 3: Invoke the `code-review:code-review` skill on the full feature branch**

Use the Skill tool with `skill: "code-review:code-review"`. Brief:

> Final review of the full invite-only landing page implementation across all 8 phases. Walk the verification list in `docs/superpowers/specs/2026-04-27-invite-only-landing-page-design.md` lines 405-417 and confirm each item is satisfied. Spot-check: (a) the `(public)` route group is exempt from auth; (b) `/sample-trip/lisbon` shareable; (c) all admin routes founder-gated; (d) Stripe webhook stamps both `first_paid_at` and `founding_crew_at`; (e) no emoji codepoints in any rendered HTML on `/`, `/apply`, `/sample-trip/lisbon`, `/join/<token>`; (f) no competitor brand names anywhere. Flag anything missing.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm exec vitest run && pnpm test`
Expected: all unit + Playwright suites green.

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "chore(phase 8): apply final review feedback"
```

Skip if no changes were needed.

---

**Phase 8 ship-ready check:** Feature complete. The founder can ship to production with confidence the content guards hold and the analytics surface is live.

---

## Skill integration

The plan integrates three skills into the workflow. They are not optional — every task referencing them is a hard step.

**`frontend-design:frontend-design`** — invoked at the top of every task that produces a user-facing component. The brief in each UI task is the spec for the skill; the skill produces the JSX. The engineer's job is to (a) pass the brief verbatim, (b) verify the output against the per-task conformance checklist, (c) place the result at the target path, (d) ship. Tasks using this skill: **9, 10, 14, 15, 16, 17, 19, 26, 27, 32**.

**`simplify`** — invoked at every phase closeout. Reviews the files changed in the phase for reuse opportunities, redundancy, and quality issues that conflict with `CLAUDE.md`. Used in all 8 phase closeouts.

**`code-review:code-review`** — invoked at every phase closeout, immediately after `simplify`. Reviews the phase's commits as if for a PR, focused on correctness, security (RLS, secrets, input validation), and consistency with the implementation plan. Used in all 8 phase closeouts; Phase 8 expands the brief to a full-feature review walking the spec's verification list.

If a closeout's `simplify` or `code-review` produces concrete fixes, commit them under `chore(phase N): apply simplify + code-review feedback` before advancing to the next phase. If neither produces changes, skip the commit.

## Self-review

**Spec coverage check (every spec section maps to a task):**

- Block 1 (Hero) → Task 14
- Block 2 (How it works) → Task 15
- Block 3 (Sample trip section) → Task 16 (tile) + Task 21 (full page)
- Block 4 (Application form) → Task 9 (form) + Task 8 (action) + Task 10 (confirmation)
- Block 5 (Pricing reveal) → Task 17
- Block 6 (Invite-link landing) → Task 19 (renderer) + Task 22 (rewrite)
- Block 7 (Admin approval flow) → Tasks 23-28
- Application data model + analytics → Tasks 1, 2, 32
- Founding Crew counter → Tasks 3, 17, 29
- Stripe webhook conversion linkage → Task 29
- Canonical pricing doc rewrite → Task 30
- Verification list → Task 33 + Task 31 (founding counter), Task 11 (apply flow)
- Files list (new + edited) → covered by tasks above

**Placeholder scan:** No "TBD", "TODO", "implement later", "similar to Task N", or "add appropriate error handling" placeholders. Each step has runnable code blocks or commands.

**Type consistency check:**
- `Application` and the four enum types are defined in Task 4 and used in Tasks 5-33.
- `MAX_SCORE` is exported from `src/lib/applications/scoring.ts` (Task 5) and consumed in `ApplicationRow` (Task 26) and `ApplicationDetail` (Task 27).
- `requireFounder` and `FounderForbiddenError` defined in Task 23 are imported by Tasks 25, 26, 27, 28, 32.
- `submitApplication`, `approveApplication`, `rejectApplication`, `updateAdminNotes`, `getApplicationCount` named consistently across action files and consumers.
- `TripPreview` and its `TripPreviewVariant` / `TripPreviewSchedule` types defined in Task 19 and consumed in Tasks 21 and 22.

**Total task count:** 33 tasks across 8 phases.
