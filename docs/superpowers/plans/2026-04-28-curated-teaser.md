# Curated Trip Personalised Teaser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cold `/apply` form leak on `/curated/[slug]` with a personalised teaser flow that captures origin/crew/when/budget/email upfront, generates a calibrated AI teaser, and funnels into a tier-aware conversion path (Founding fast lane + Crew Plus theatrical real review).

**Architecture:** A form-first hard gate on `/curated/[slug]` (no plan content visible until form submit). Submit calls a Gemini 3 Flash Preview server action that scales the existing curated trip JSON to the visitor's inputs and persists a `draft_leads` row. Cookie-driven returning visitor flow. Conversion CTAs split: Founding triggers an atomic 500-seat Postgres reservation + Stripe Checkout; Crew Plus reshapes `/apply` to skip captured fields, persists with a `provisional_decision` heuristic, runs through a 24h admin review window with a cron auto-finalise fallback. Stripe webhook on payment provisions the user's first trip pre-seeded with the captured draft data, closing the loop from teaser to product.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 with `@theme` tokens · Supabase Postgres + Auth · `@google/genai` (Gemini 3 Flash Preview) · Zod · Stripe · pnpm · Playwright + axe-core for tests.

**Spec reference:** [docs/superpowers/specs/2026-04-28-curated-teaser-design.md](../specs/2026-04-28-curated-teaser-design.md)

**UI implementation rule:** Every task that touches a React component (`src/components/**`, `src/app/**/page.tsx`, `src/app/**/layout.tsx`) MUST be executed via the `frontend-design` skill. Server actions, migrations, types, prompts, schemas, cron handlers, and webhook updates are implemented directly.

**Schema reconciliation note:** The existing `applications` table uses `role` (organiser/attendee/depends), `pain` (dates/booking/money/plan/chaos), and `budget_attitude` (monopoly/splurge/count/depends) — different from the spec's "chat_stage" wording. This plan honours the existing schema. The teaser-aware `/apply` skips the `email` field (already captured) but still asks the existing 4 ICP questions. The heuristic uses the existing fields.

---

## File Structure

### New files

**Migrations (run in order):**
- `supabase/migrations/20260430000000_draft_leads.sql` — `draft_leads` table + RLS + indexes
- `supabase/migrations/20260430000100_founding_reservations.sql` — `founding_reservations` table + `reserve_founding_seat` function
- `supabase/migrations/20260430000200_applications_review_columns.sql` — adds `draft_lead_id`, `provisional_decision`, `auto_decision_at`, `decision_finalised_at`, `decision_finalised_by` to `applications`

**Types:**
- (no new file — extend `src/lib/types.ts` in place)

**Validators:**
- `src/lib/validators/teaser.ts` — Zod schemas for teaser inputs and outputs

**AI:**
- `src/lib/ai/teaserPrompt.ts` — prompt builder for teaser generation
- `src/lib/ai/teaserSchema.ts` — Zod schema for teaser output (kept separate from existing `schema.ts` for isolation)

**Server actions:**
- `src/lib/actions/teaser.ts` — `submitTeaserForm`, `unsubscribeDraftLead`
- `src/lib/actions/foundingReservation.ts` — `claimFoundingSeat`
- `src/lib/actions/draftLeadResume.ts` — `validateResumeToken`

**Email:**
- `src/lib/email/teaserEmails.ts` — `sendTeaserConfirmation`, `sendDay7Nudge`, `sendApplicationApproved`, `sendApplicationSoftRejected`, `sendApplicationReceived`

**Components (UI — built via `frontend-design`):**
- `src/components/marketing/curated/TeaserForm.tsx`
- `src/components/marketing/curated/TypicalSpecStrip.tsx`
- `src/components/marketing/curated/CuratedTripGateView.tsx`
- `src/components/marketing/curated/CuratedTripPersonalisedView.tsx`
- `src/components/marketing/curated/PersonalisedSpecGrid.tsx`
- `src/components/marketing/curated/PersonalisedTeaserBlocks.tsx`
- `src/components/marketing/curated/ConversionCTAs.tsx`
- `src/components/marketing/curated/RateLimitedNotice.tsx`
- `src/components/marketing/curated/FoundingCheckoutHold.tsx`
- `src/components/marketing/curated/SkipTheQueueUpsell.tsx`

**Routes:**
- `src/app/(public)/curated/[slug]/founding-checkout/page.tsx` — seat-hold confirmation + Stripe init
- `src/app/(public)/curated/[slug]/applied/page.tsx` — Crew Plus application-received state
- `src/app/api/cron/teaser-day-7-nudge/route.ts`
- `src/app/api/cron/finalise-applications/route.ts`
- `vercel.ts` — cron schedules

**Tests:**
- `src/lib/actions/__tests__/teaser.test.ts`
- `src/lib/actions/__tests__/foundingReservation.test.ts`
- `src/lib/ai/__tests__/teaserSchema.test.ts`
- `tests/e2e/curated-teaser.spec.ts` — Playwright smoke + axe

### Modified files

- `src/app/(public)/curated/[slug]/page.tsx` — three-state render (gate / personalised / resume)
- `src/components/marketing/CuratedTripView.tsx` — extract data helpers; remove public schedule/stays/flights/bookings rendering
- `src/components/marketing/DepartureBoard.tsx` — collapse two CTAs to one (`Plan your {city} →` → `/curated/{slug}`)
- `src/app/(public)/apply/page.tsx` — detect draft cookie; skip email; show 4 existing ICP questions
- `src/components/marketing/ApplicationForm.tsx` — accept optional `draftLeadId` prop, hide email when present
- `src/lib/actions/applications.ts` — set `draft_lead_id`, compute heuristic, set `provisional_decision` + `auto_decision_at`
- `src/lib/actions/approveApplication.ts` — fire approval email with Stripe Checkout link
- `src/lib/actions/rejectApplication.ts` — fire soft-rejection email
- `src/app/(app)/admin/applications/queue/page.tsx` — show provisional decision + draft data inline
- `src/app/(app)/admin/applications/[id]/page.tsx` — show full draft, provisional decision, approve/reject CTAs
- `src/app/api/stripe/webhook/route.ts` — on `payment_intent.succeeded`, consume founding reservation + create first trip from draft
- `src/lib/types.ts` — `DraftLead`, `TeaserOutput`, `FoundingReservation`, application column additions

---

## Phase 1: Lead Capture MVP

**Ships:** Form-first `/curated/[slug]`, Gemini-generated personalised teaser persisted to `draft_leads`, day-0 confirmation email, lifetime IP rate limit, returning visitor cookie flow. **Does not yet ship:** Conversion (apply CTAs at the bottom of the personalised view link to a stub page in this phase).

### Task 1.1: Add `draft_leads` migration

**Files:**
- Create: `supabase/migrations/20260430000000_draft_leads.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260430000000_draft_leads.sql
-- Lead-magnet capture for curated trip personalised teaser flow.
-- One row per (cache_key, ip_hash). Rate-limited to 2 per ip_hash lifetime
-- in the application layer; cache lookup happens before AI call.

create table if not exists draft_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip_hash text not null,
  slug text not null,
  inputs jsonb not null,
  teaser jsonb,
  cache_key text not null,
  resume_token text not null default encode(gen_random_bytes(32), 'hex'),
  nudge_sent_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create index draft_leads_cache_key_idx on draft_leads (cache_key);
create index draft_leads_ip_idx on draft_leads (ip_hash);
create index draft_leads_email_idx on draft_leads (email);
create index draft_leads_resume_token_idx on draft_leads (resume_token);
create index draft_leads_nudge_eligible_idx on draft_leads (created_at)
  where nudge_sent_at is null and unsubscribed_at is null;

alter table draft_leads enable row level security;

create policy "draft_leads_anon_insert" on draft_leads
  for insert
  to anon, authenticated
  with check (true);

-- Read/update/delete: service-role only (no policies).
```

- [ ] **Step 2: Apply migration locally**

```bash
pnpm supabase db reset
```

Expected: table created, indexes created, no errors.

- [ ] **Step 3: Verify with psql**

```bash
pnpm supabase db psql -- -c "\d draft_leads"
```

Expected: shows table with all columns, RLS enabled, 5 indexes, 1 policy.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260430000000_draft_leads.sql
git commit -m "feat(teaser): draft_leads table for curated trip lead capture"
```

### Task 1.2: Add `DraftLead` and `TeaserOutput` types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add types**

Append to `src/lib/types.ts`:

```ts
export type TeaserInputs = {
  origin: string;
  crew: "2" | "3-4" | "5-6" | "7+";
  when: "weekend" | "week" | "two-weeks" | "flexible";
  budget: "500" | "1000" | "1500" | "2000+";
};

export type TeaserOutput = {
  spec: {
    perHead: string;
    crew: string;
    origin: string;
    vibes: string;
  };
  hero_paragraph: string;
  days: Array<{ day: string; place: string; note: string }>;
  stay: { neighbourhood: string; priceBand: string };
  flights: { priceBand: string };
  bookings_count: number;
  weather: string;
};

export type DraftLead = {
  id: string;
  email: string;
  ip_hash: string;
  slug: string;
  inputs: TeaserInputs;
  teaser: TeaserOutput | null;
  cache_key: string;
  resume_token: string;
  nudge_sent_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
};
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(teaser): add DraftLead, TeaserInputs, TeaserOutput types"
```

### Task 1.3: Add Zod validators for teaser input

**Files:**
- Create: `src/lib/validators/teaser.ts`

- [ ] **Step 1: Write the validator**

```ts
import { z } from "zod";

export const teaserInputsSchema = z.object({
  origin: z
    .string()
    .regex(/^[A-Z]{3}$/u, "Origin must be a 3-letter IATA code")
    .transform((v) => v.toUpperCase()),
  crew: z.enum(["2", "3-4", "5-6", "7+"]),
  when: z.enum(["weekend", "week", "two-weeks", "flexible"]),
  budget: z.enum(["500", "1000", "1500", "2000+"]),
});

export const teaserSubmissionSchema = teaserInputsSchema.extend({
  email: z.string().email("Enter a valid email").max(254),
  slug: z.string().min(1).max(64),
});

export type TeaserSubmission = z.infer<typeof teaserSubmissionSchema>;

export function normalizeTeaserInputs(input: z.infer<typeof teaserInputsSchema>): string {
  return JSON.stringify({
    origin: input.origin,
    crew: input.crew,
    when: input.when,
    budget: input.budget,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/validators/teaser.ts
git commit -m "feat(teaser): zod schemas for teaser submission"
```

### Task 1.4: Add Zod schema for teaser output (AI response)

**Files:**
- Create: `src/lib/ai/teaserSchema.ts`
- Test: `src/lib/ai/__tests__/teaserSchema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/ai/__tests__/teaserSchema.test.ts
import { describe, it, expect } from "vitest";
import { parseTeaserOutput } from "../teaserSchema";

describe("parseTeaserOutput", () => {
  const valid = {
    spec: { perHead: "£1,200", crew: "6", origin: "MAN", vibes: "Wellness · Surf" },
    hero_paragraph: "Six of you, leaving MAN on 14 June, around £1,200pp.",
    days: [
      { day: "Day 1", place: "Arrival in Canggu", note: "Land, settle in, sunset dinner near the villa." },
      { day: "Day 4", place: "Mount Batur sunrise", note: "Early start, hot springs after, breakfast back at the villa." },
    ],
    stay: { neighbourhood: "Canggu", priceBand: "~£140 / night" },
    flights: { priceBand: "MAN→DPS from ~£680pp" },
    bookings_count: 12,
    weather: "June: dry season, 28°C average.",
  };

  it("accepts valid teaser output", () => {
    const result = parseTeaserOutput(valid);
    expect(result.days).toHaveLength(2);
    expect(result.spec.perHead).toBe("£1,200");
  });

  it("rejects fewer than 2 days", () => {
    expect(() => parseTeaserOutput({ ...valid, days: [valid.days[0]] })).toThrow();
  });

  it("rejects more than 2 days", () => {
    expect(() =>
      parseTeaserOutput({ ...valid, days: [...valid.days, valid.days[0]] }),
    ).toThrow();
  });

  it("rejects negative bookings_count", () => {
    expect(() => parseTeaserOutput({ ...valid, bookings_count: -1 })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run src/lib/ai/__tests__/teaserSchema.test.ts
```

Expected: FAIL with "Cannot find module '../teaserSchema'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/ai/teaserSchema.ts
import { z } from "zod";

const dayBlockSchema = z.object({
  day: z.string().min(1).max(40),
  place: z.string().min(1).max(80),
  note: z.string().min(1).max(280),
});

export const teaserOutputSchema = z.object({
  spec: z.object({
    perHead: z.string().min(1).max(20),
    crew: z.string().min(1).max(20),
    origin: z.string().min(1).max(20),
    vibes: z.string().min(1).max(60),
  }),
  hero_paragraph: z.string().min(40).max(280),
  days: z.array(dayBlockSchema).length(2),
  stay: z.object({
    neighbourhood: z.string().min(1).max(40),
    priceBand: z.string().min(1).max(40),
  }),
  flights: z.object({
    priceBand: z.string().min(1).max(80),
  }),
  bookings_count: z.number().int().nonnegative().max(99),
  weather: z.string().min(1).max(200),
});

export function parseTeaserOutput(raw: unknown) {
  return teaserOutputSchema.parse(raw);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm exec vitest run src/lib/ai/__tests__/teaserSchema.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/teaserSchema.ts src/lib/ai/__tests__/teaserSchema.test.ts
git commit -m "feat(teaser): zod schema for AI teaser output (length-locked to 2 days)"
```

### Task 1.5: Build the teaser prompt

**Files:**
- Create: `src/lib/ai/teaserPrompt.ts`

- [ ] **Step 1: Write the prompt builder**

```ts
// src/lib/ai/teaserPrompt.ts
import type { CuratedTrip } from "@/lib/marketing/curatedTrips";
import type { TeaserInputs } from "@/lib/types";

const CREW_LABEL: Record<TeaserInputs["crew"], string> = {
  "2": "two of you",
  "3-4": "three or four of you",
  "5-6": "five or six of you",
  "7+": "seven plus",
};

const DURATION_HINT: Record<TeaserInputs["when"], string> = {
  weekend: "a 3-day weekend",
  week: "a 7-day week",
  "two-weeks": "a 14-day stretch",
  flexible: "a 7-day window (default to a week if no clear preference)",
};

const BUDGET_HINT: Record<TeaserInputs["budget"], string> = {
  "500": "around £500 per head",
  "1000": "around £1,000 per head",
  "1500": "around £1,500 per head",
  "2000+": "£2,000+ per head",
};

export function buildTeaserPrompt(trip: CuratedTrip, inputs: TeaserInputs): string {
  return `You are drafting a personalised teaser of the ${trip.city} curated trip for a Tripcrew applicant.

THEIR INPUTS:
- Origin airport: ${inputs.origin}
- Crew size: ${CREW_LABEL[inputs.crew]}
- When: ${DURATION_HINT[inputs.when]}
- Budget: ${BUDGET_HINT[inputs.budget]}

CURATED TRIP CONTEXT (the canonical full plan you're scaling from):
- Destination: ${trip.city}, ${trip.country}
- Tagline: ${trip.tagline}
- Vibes: ${trip.vibesLabel}
- Typical crew: ${trip.crewLabel}
- Typical dates window: ${trip.datesLabel}
- Typical per-head: £${trip.perHeadAmount.toLocaleString("en-GB")}
- Total days in canonical plan: ${trip.totalDays}
- Day-by-day plan (do NOT include specific restaurants/hotels/activity providers from this in your output — vibe only):
${trip.fullSchedule.map((row) => `  · ${row.day} — ${row.place}: ${row.note}`).join("\n")}
- Typical flight quotes (used for price band only):
${trip.flights.map((f) => `  · ${f.carrier} ${f.route} ${f.pricePerHead}`).join("\n")}
- Typical stay options (used for neighbourhood and price band only):
${trip.stays.map((s) => `  · ${s.name} in ${s.neighbourhood}, ${s.pricePerNight}/night`).join("\n")}
- Bookings count (the number of distinct items to lock): ${trip.bookings.length}

CALIBRATION RULES (CRITICAL):
- Pick exactly TWO days from the curated plan: day 1 (arrival) and one middle day.
- Day descriptions: vibe-only ("morning surf, slow lunch, sunset cliff jump"). NEVER name specific restaurants, hotels, or activity providers.
- Stay output: neighbourhood + price band ONLY. NEVER name a specific stay.
- Flights output: price band only ("from ~£XXXpp"). NEVER name a carrier or schedule.
- Bookings output: count only.
- Hero paragraph: ONE paragraph, 40-280 chars, mentions their crew size, their origin airport, plausible specific dates within the trip's season, and their budget per head.
- Specific dates: pick a plausible window inside the trip's typical dates (${trip.datesLabel}). Match their "when" duration. Use British date format ("14–20 June").
- Weather: one line about the season at those dates.
- Output STRICTLY this JSON shape:

{
  "spec": { "perHead": "£X,XXX", "crew": "<their crew>", "origin": "${inputs.origin}", "vibes": "<trip vibes>" },
  "hero_paragraph": "<one paragraph>",
  "days": [
    { "day": "Day 1", "place": "<place name>", "note": "<vibe-only description>" },
    { "day": "Day N", "place": "<place name>", "note": "<vibe-only description>" }
  ],
  "stay": { "neighbourhood": "<area name>", "priceBand": "~£XXX / night" },
  "flights": { "priceBand": "${inputs.origin}→<dest IATA> from ~£XXXpp" },
  "bookings_count": <integer>,
  "weather": "<one-line seasonal note>"
}

Return ONLY the JSON. No prose, no markdown, no preamble.`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ai/teaserPrompt.ts
git commit -m "feat(teaser): gemini prompt builder with calibration rules"
```

### Task 1.6: Build the `submitTeaserForm` server action

**Files:**
- Create: `src/lib/actions/teaser.ts`
- Test: `src/lib/actions/__tests__/teaser.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/actions/__tests__/teaser.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitTeaserForm } from "../teaser";

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));
vi.mock("@/lib/ai/gemini", () => ({
  generateJson: vi.fn(),
}));

const validInput = {
  email: "test@example.com",
  origin: "MAN",
  crew: "5-6" as const,
  when: "week" as const,
  budget: "1500" as const,
  slug: "bali",
};

describe("submitTeaserForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects when email is invalid", async () => {
    const result = await submitTeaserForm({ ...validInput, email: "not-an-email" }, "1.2.3.4");
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/email/i) });
  });

  it("rejects when ip already has 2 draft_leads", async () => {
    // mock: count returns 2
    // assert: result is { ok: false, error: rate-limited, redirect: "/apply" }
  });

  it("returns cached teaser on cache hit (same slug + same inputs)", async () => {
    // mock: cache_key match returns row with non-null teaser
    // assert: generateJson NOT called
  });

  it("calls Gemini, persists row, returns teaser on cache miss", async () => {
    // mock: count = 0, cache miss, gemini returns valid teaser
    // assert: insert called, teaser returned
  });

  it("rejects unknown slug", async () => {
    const result = await submitTeaserForm({ ...validInput, slug: "atlantis" }, "1.2.3.4");
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/trip/i) });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run src/lib/actions/__tests__/teaser.test.ts
```

Expected: FAIL with "Cannot find module '../teaser'".

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/actions/teaser.ts
"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { generateJson, estimateGeminiCostGBP } from "@/lib/ai/gemini";
import { recordAiUsage } from "@/lib/ai/usage";
import { buildTeaserPrompt } from "@/lib/ai/teaserPrompt";
import { parseTeaserOutput } from "@/lib/ai/teaserSchema";
import {
  teaserSubmissionSchema,
  normalizeTeaserInputs,
} from "@/lib/validators/teaser";
import { getCuratedTripBySlug } from "@/lib/marketing/curatedTrips";
import { sendTeaserConfirmation } from "@/lib/email/teaserEmails";
import type { DraftLead, TeaserOutput } from "@/lib/types";

const COOKIE_NAME = "tc_draft_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
const RATE_LIMIT = 2;

const IP_SALT = process.env.IP_HASH_SALT;

function hashIp(ip: string): string {
  if (!IP_SALT) throw new Error("IP_HASH_SALT not configured");
  return createHash("sha256").update(`${ip}:${IP_SALT}`).digest("hex");
}

function buildCacheKey(slug: string, normalizedInputs: string): string {
  return createHash("sha256").update(`${slug}:${normalizedInputs}`).digest("hex");
}

export type SubmitTeaserResult =
  | { ok: true; draftId: string; teaser: TeaserOutput }
  | { ok: false; error: string; rateLimited?: boolean };

export async function submitTeaserForm(
  rawInput: unknown,
  ip: string,
): Promise<SubmitTeaserResult> {
  const parsed = teaserSubmissionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const trip = getCuratedTripBySlug(parsed.data.slug);
  if (!trip) {
    return { ok: false, error: "Unknown trip" };
  }

  const supabase = createServiceClient();
  const ipHash = hashIp(ip);

  // Rate-limit check (lifetime)
  const { count } = await supabase
    .from("draft_leads")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash);

  if ((count ?? 0) >= RATE_LIMIT) {
    return {
      ok: false,
      error: "You've already started two drafts. To start more, apply for an invite.",
      rateLimited: true,
    };
  }

  // Cache lookup
  const inputsForCache = {
    origin: parsed.data.origin,
    crew: parsed.data.crew,
    when: parsed.data.when,
    budget: parsed.data.budget,
  };
  const cacheKey = buildCacheKey(parsed.data.slug, normalizeTeaserInputs(inputsForCache));

  const { data: cached } = await supabase
    .from("draft_leads")
    .select("*")
    .eq("cache_key", cacheKey)
    .not("teaser", "is", null)
    .limit(1)
    .maybeSingle<DraftLead>();

  let teaser: TeaserOutput;
  let inputTokens = 0;
  let outputTokens = 0;
  let durationMs = 0;
  let model = "";

  if (cached?.teaser) {
    teaser = cached.teaser;
  } else {
    const prompt = buildTeaserPrompt(trip, inputsForCache);
    const result = await generateJson(prompt, parseTeaserOutput);
    teaser = result.data;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
    durationMs = result.durationMs;
    model = result.model;
  }

  // Insert draft_leads row
  const { data: inserted, error: insertError } = await supabase
    .from("draft_leads")
    .insert({
      email: parsed.data.email,
      ip_hash: ipHash,
      slug: parsed.data.slug,
      inputs: inputsForCache,
      teaser,
      cache_key: cacheKey,
    })
    .select("id, resume_token")
    .single<{ id: string; resume_token: string }>();

  if (insertError || !inserted) {
    console.error("submitTeaserForm insert failed", insertError);
    return { ok: false, error: "Could not save your draft. Try again." };
  }

  // Record AI usage on cache miss
  if (!cached?.teaser) {
    await recordAiUsage({
      purpose: "curated_teaser",
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_gbp: estimateGeminiCostGBP(inputTokens, outputTokens),
      duration_ms: durationMs,
      ref_id: inserted.id,
    });
  }

  // Set cookie
  const jar = await cookies();
  jar.set(COOKIE_NAME, inserted.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  // Fire confirmation email (don't block on failure)
  void sendTeaserConfirmation({
    email: parsed.data.email,
    draftId: inserted.id,
    resumeToken: inserted.resume_token,
    slug: parsed.data.slug,
    inputs: inputsForCache,
    teaser,
  }).catch((err) => console.error("teaser confirmation email failed", err));

  return { ok: true, draftId: inserted.id, teaser };
}

export async function unsubscribeDraftLead(
  draftId: string,
  token: string,
): Promise<{ ok: boolean }> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("draft_leads")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("id", draftId)
    .eq("resume_token", token);
  return { ok: !error };
}
```

- [ ] **Step 4: Add `recordAiUsage` if not present**

Check `src/lib/ai/usage.ts` — if `recordAiUsage` already accepts a `purpose` field, skip. If not, add a `purpose` column to `ai_usage` migration and update the helper. (Verify before proceeding.)

```bash
grep "purpose" src/lib/ai/usage.ts
```

If the helper doesn't accept a `purpose` field, add a migration to extend `ai_usage` with `purpose text` and update the helper signature.

- [ ] **Step 5: Add `IP_HASH_SALT` to env**

Append to `.env.local`:

```
IP_HASH_SALT=<random 32-char hex>
```

Generate via:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add same to Vercel env via `vercel env add IP_HASH_SALT`.

- [ ] **Step 6: Fill in test mocks and run tests**

Complete the test bodies based on the implementation above (mock supabase chain, mock generateJson). Run:

```bash
pnpm exec vitest run src/lib/actions/__tests__/teaser.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/teaser.ts src/lib/actions/__tests__/teaser.test.ts
git commit -m "feat(teaser): submitTeaserForm action with rate limit + cache"
```

### Task 1.7: Build the day-0 confirmation email

**Files:**
- Create: `src/lib/email/teaserEmails.ts`

- [ ] **Step 1: Inspect existing transactional email setup**

```bash
grep -r "from: " src/lib/email 2>&1 | head -10
ls src/lib/email/ 2>&1
```

Determine the existing email infra (Resend? Supabase? other). Reuse the same transport.

- [ ] **Step 2: Write the email module**

```ts
// src/lib/email/teaserEmails.ts
import type { TeaserInputs, TeaserOutput } from "@/lib/types";
// Reuse existing email transport, e.g.:
import { sendTransactionalEmail } from "./transport";

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tripcrew.app";

function cityFromSlug(slug: string): string {
  // simple title-case helper
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

function inputsLine(inputs: TeaserInputs): string {
  const crew =
    inputs.crew === "2" ? "two of you" :
    inputs.crew === "3-4" ? "three or four of you" :
    inputs.crew === "5-6" ? "five or six of you" :
    "seven plus";
  const when =
    inputs.when === "weekend" ? "a long weekend" :
    inputs.when === "week" ? "a week" :
    inputs.when === "two-weeks" ? "two weeks" :
    "flexible dates";
  const budget = `~£${inputs.budget === "2000+" ? "2,000+" : Number(inputs.budget).toLocaleString("en-GB")}pp`;
  return `${crew}, leaving ${inputs.origin}, ${when}, ${budget}`;
}

export async function sendTeaserConfirmation(params: {
  email: string;
  draftId: string;
  resumeToken: string;
  slug: string;
  inputs: TeaserInputs;
  teaser: TeaserOutput;
}) {
  const city = cityFromSlug(params.slug);
  const resumeUrl = `${ORIGIN}/curated/${params.slug}?resume=${params.draftId}&token=${params.resumeToken}`;
  const unsubscribeUrl = `${ORIGIN}/api/teaser/unsubscribe?id=${params.draftId}&token=${params.resumeToken}`;

  await sendTransactionalEmail({
    to: params.email,
    subject: `Your ${city} draft is saved.`,
    text: [
      `${inputsLine(params.inputs)}.`,
      ``,
      params.teaser.hero_paragraph,
      ``,
      `Resume your draft: ${resumeUrl}`,
      ``,
      `When you're ready, apply to unlock the full plan and book it with your crew.`,
      ``,
      `— Tripcrew`,
      ``,
      `Unsubscribe: ${unsubscribeUrl}`,
    ].join("\n"),
  });
}

export async function sendDay7Nudge(params: {
  email: string;
  draftId: string;
  resumeToken: string;
  slug: string;
  foundingRemaining: number;
}) {
  const city = cityFromSlug(params.slug);
  const resumeUrl = `${ORIGIN}/curated/${params.slug}?resume=${params.draftId}&token=${params.resumeToken}`;
  const unsubscribeUrl = `${ORIGIN}/api/teaser/unsubscribe?id=${params.draftId}&token=${params.resumeToken}`;

  await sendTransactionalEmail({
    to: params.email,
    subject: `Your ${city} draft + a heads-up on founding spots.`,
    text: [
      `Quick heads-up: ${params.foundingRemaining} of 500 founding spots remain.`,
      ``,
      `Founding spots are price-locked at £179/year for life — once they're gone, that price disappears.`,
      ``,
      `Your ${city} draft is still saved here: ${resumeUrl}`,
      ``,
      `— Tripcrew`,
      ``,
      `Unsubscribe: ${unsubscribeUrl}`,
    ].join("\n"),
  });
}
```

- [ ] **Step 3: Add unsubscribe API route**

Create `src/app/api/teaser/unsubscribe/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { unsubscribeDraftLead } from "@/lib/actions/teaser";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const token = req.nextUrl.searchParams.get("token");
  if (!id || !token) {
    return new NextResponse("Missing parameters", { status: 400 });
  }
  const result = await unsubscribeDraftLead(id, token);
  return new NextResponse(
    result.ok ? "You're unsubscribed. Sorry to see you go." : "Could not unsubscribe.",
    { status: result.ok ? 200 : 400, headers: { "content-type": "text/plain" } },
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/email/teaserEmails.ts src/app/api/teaser/unsubscribe/route.ts
git commit -m "feat(teaser): day-0 confirmation email + unsubscribe endpoint"
```

### Task 1.8: Build the resume-token validator

**Files:**
- Create: `src/lib/actions/draftLeadResume.ts`

- [ ] **Step 1: Write the validator**

```ts
// src/lib/actions/draftLeadResume.ts
"use server";

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import type { DraftLead } from "@/lib/types";

const COOKIE_NAME = "tc_draft_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

export async function readDraftFromCookie(slug: string): Promise<DraftLead | null> {
  const jar = await cookies();
  const id = jar.get(COOKIE_NAME)?.value;
  if (!id) return null;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("draft_leads")
    .select("*")
    .eq("id", id)
    .eq("slug", slug)
    .maybeSingle<DraftLead>();
  return data ?? null;
}

export async function validateResumeToken(
  draftId: string,
  token: string,
  slug: string,
): Promise<DraftLead | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("draft_leads")
    .select("*")
    .eq("id", draftId)
    .eq("resume_token", token)
    .eq("slug", slug)
    .maybeSingle<DraftLead>();

  if (!data) return null;

  // Re-attach cookie
  const jar = await cookies();
  jar.set(COOKIE_NAME, data.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/draftLeadResume.ts
git commit -m "feat(teaser): cookie + resume-token draft lookups"
```

### Task 1.9: Build UI — TeaserForm + TypicalSpecStrip + GateView

**REQUIRED SUB-SKILL:** `frontend-design`.

**Files:**
- Create: `src/components/marketing/curated/TeaserForm.tsx`
- Create: `src/components/marketing/curated/TypicalSpecStrip.tsx`
- Create: `src/components/marketing/curated/CuratedTripGateView.tsx`
- Create: `src/components/marketing/curated/RateLimitedNotice.tsx`

- [ ] **Step 1: Use frontend-design**

Invoke `frontend-design` with this brief:

> Build the four components above using the existing editorial-brutalist token system (`bg-cream`, `text-ink`, `bg-marketing-coral`, `font-serif`, font-mono mono-cap eyebrows, hard 2px borders). Aesthetic must match `src/components/marketing/Hero.tsx` and `src/components/marketing/CuratedTripView.tsx`'s `Header` block.
>
> **TeaserForm.tsx**: A 5-field form. Fields: airport-autocomplete `origin` (reuse existing autocomplete from `src/lib/actions/airports.ts`), 4-button radio `crew` (2 / 3–4 / 5–6 / 7+), 4-button radio `when` (a weekend / a week / two weeks / flexible), 4-button radio `budget` (~£500 / ~£1k / ~£1.5k / ~£2k+), email input. Submit button: "See my {City} →" filled marketing-coral. Use `useFormState` with the `submitTeaserForm` server action. On error result with `rateLimited: true`, render `RateLimitedNotice`. On success result, do NOT render anything (parent re-renders the page in personalised state).
>
> **TypicalSpecStrip.tsx**: Takes a `CuratedTrip` prop. Renders a 4-cell horizontal strip: `Per head ~£X,XXX`, `Crew Y`, `Z days`, `LHR origin`. Mono-cap labels above, serif values below. Top label: `TYPICAL` in mono-cap marketing-coral-deep, signalling "these are the trip's defaults; your version comes after the form."
>
> **CuratedTripGateView.tsx**: Server component. Composes Header (existing, in `CuratedTripView.tsx` — extract or reuse), TypicalSpecStrip, and TeaserForm. No schedule/stays/flights/bookings render.
>
> **RateLimitedNotice.tsx**: Client-rendered notice. Mono-cap eyebrow `LIMIT REACHED`, serif "You've already started two drafts." paragraph, link `Apply for an invite →` to `/apply`.
>
> Run Playwright + axe on `/curated/bali` after build to confirm 0 violations. Take a screenshot for the diff record.

- [ ] **Step 2: Commit**

```bash
git add src/components/marketing/curated/
git commit -m "feat(teaser): gate-view UI (form + typical spec + rate-limit notice)"
```

### Task 1.10: Build UI — PersonalisedView + ConversionCTAs (stub)

**REQUIRED SUB-SKILL:** `frontend-design`.

**Files:**
- Create: `src/components/marketing/curated/CuratedTripPersonalisedView.tsx`
- Create: `src/components/marketing/curated/PersonalisedSpecGrid.tsx`
- Create: `src/components/marketing/curated/PersonalisedTeaserBlocks.tsx`
- Create: `src/components/marketing/curated/ConversionCTAs.tsx`

- [ ] **Step 1: Use frontend-design**

Invoke `frontend-design` with this brief:

> Build the four components below in the editorial-brutalist token system. Aesthetic continues from `Hero.tsx` and `CuratedTripView.tsx`.
>
> **PersonalisedSpecGrid.tsx**: Takes `inputs` and `teaser.spec` props. Renders a 4-cell grid: `Per head ${teaser.spec.perHead}`, `Crew ${teaser.spec.crew}`, `Origin ${teaser.spec.origin}`, `Vibes ${teaser.spec.vibes}`. Visual identical to existing curated-trip SpecBlock, just with personalised values.
>
> **PersonalisedTeaserBlocks.tsx**: Takes `teaser` prop. Renders four sections vertically:
>   1. Hero paragraph block (serif, large, italics on the dates)
>   2. Schedule block: "Your version, sketched." mono-cap, then 2 day rows (day, place, vibe-only note), then a calligraphic line "+{trip.totalDays - 2} more days, in your full plan."
>   3. Stay + Flights block: 2-column "Where you'd stay" (neighbourhood + price band) and "How you'd get there" (price band)
>   4. Bookings count block: "{teaser.bookings_count} things to lock — your full plan covers them."
> Watermark line below: `DRAFT PREVIEW · APPLY TO UNLOCK + BOOK WITH YOUR CREW.` mono-cap marketing-coral-deep, with a tiny corner watermark icon if it fits.
>
> **ConversionCTAs.tsx**: Takes `draftId` and `slug` props. Two CTAs:
>   - Primary `Apply to unlock the full plan →` → `/apply?draft={draftId}` (filled coral)
>   - Secondary `Claim a founding spot →` → `/curated/{slug}/founding-checkout?draft={draftId}` (cream-bordered)
> Below CTAs, the small membership-cost line: `CREW PLUS · £9 / MO · ONE ADMIN PAYS, THE WHOLE CREW GETS IN.`
>
> **CuratedTripPersonalisedView.tsx**: Server component. Composes Header (with personalised tagline derived from teaser hero_paragraph), PersonalisedSpecGrid, PersonalisedTeaserBlocks, ConversionCTAs. Above the personalised content, a mono-cap row `Change inputs ↺` linking to `/curated/{slug}?reset=1` (which clears the cookie and shows the form again).
>
> Run Playwright + axe on the personalised state (mock cookie). 0 violations. Take a screenshot.

- [ ] **Step 2: Add the `?reset=1` cookie-clear handler**

In `src/app/(public)/curated/[slug]/page.tsx`, on `searchParams.reset === "1"`, clear the `tc_draft_id` cookie and render the gate view (or redirect without the param).

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/curated/
git commit -m "feat(teaser): personalised-view UI + conversion CTAs (founding/checkout still stubbed)"
```

### Task 1.11: Wire `/curated/[slug]` page to render gate or personalised state

**Files:**
- Modify: `src/app/(public)/curated/[slug]/page.tsx`

- [ ] **Step 1: Replace single-state render**

```ts
// src/app/(public)/curated/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { CuratedTripGateView } from "@/components/marketing/curated/CuratedTripGateView";
import { CuratedTripPersonalisedView } from "@/components/marketing/curated/CuratedTripPersonalisedView";
import { getCuratedTripBySlug } from "@/lib/marketing/curatedTrips";
import {
  readDraftFromCookie,
  validateResumeToken,
} from "@/lib/actions/draftLeadResume";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trip = getCuratedTripBySlug(slug);
  if (!trip) return { title: "Tripcrew — curated trip" };
  return {
    title: `${trip.city} · Tripcrew curated`,
    description: `${trip.tagline} See your version of ${trip.city} — origin, crew, dates, budget personalised.`,
  };
}

export default async function CuratedTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ resume?: string; token?: string; reset?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const trip = getCuratedTripBySlug(slug);
  if (!trip) notFound();

  if (sp.reset === "1") {
    const jar = await cookies();
    jar.delete("tc_draft_id");
    return <CuratedTripGateView trip={trip} />;
  }

  if (sp.resume && sp.token) {
    const draft = await validateResumeToken(sp.resume, sp.token, slug);
    if (draft && draft.teaser) {
      return <CuratedTripPersonalisedView trip={trip} draft={draft} />;
    }
  }

  const draft = await readDraftFromCookie(slug);
  if (draft && draft.teaser) {
    return <CuratedTripPersonalisedView trip={trip} draft={draft} />;
  }

  return <CuratedTripGateView trip={trip} />;
}
```

- [ ] **Step 2: Run dev server and test manually**

```bash
pnpm dev
```

Open `http://localhost:3000/curated/bali`. Verify:
- Cold visit shows hero + typical-spec strip + form (no schedule/stays/flights/bookings)
- Submit form with valid inputs → personalised view renders
- Reload → still personalised (cookie persists)
- Add `?reset=1` → form re-renders

- [ ] **Step 3: Commit**

```bash
git add src/app/\(public\)/curated/\[slug\]/page.tsx
git commit -m "feat(teaser): three-state render on curated trip route (gate/personalised/resume)"
```

### Task 1.12: Trim public CuratedTripView (remove schedule/stays/flights/bookings)

**Files:**
- Modify: `src/components/marketing/CuratedTripView.tsx`

- [ ] **Step 1: Delete public render of plan content**

The existing `CuratedTripView` has `ScheduleBlock`, `StaysBlock`, `FlightsBlock`, `BookingsBlock`, `ApplyBlock` — all of which the spec says should NOT render publicly. The new `CuratedTripGateView` and `CuratedTripPersonalisedView` replace this entire flow.

Delete the unused blocks from `CuratedTripView.tsx`. If nothing else imports it, delete the file. Verify with:

```bash
grep -rn "CuratedTripView" src/ 2>&1 | grep -v "Curated.*\(Gate\|Personalised\)"
```

If no imports remain, delete `src/components/marketing/CuratedTripView.tsx` entirely.

- [ ] **Step 2: Commit**

```bash
git add -A src/components/marketing/CuratedTripView.tsx
git commit -m "refactor(teaser): remove public CuratedTripView in favor of gate+personalised views"
```

### Task 1.13: Collapse DepartureBoard CTAs to one

**REQUIRED SUB-SKILL:** `frontend-design` (UI change).

**Files:**
- Modify: `src/components/marketing/DepartureBoard.tsx`

- [ ] **Step 1: Use frontend-design**

Invoke with brief:

> In `src/components/marketing/DepartureBoard.tsx`, replace the two CTAs per card (`Apply for a {city} plan →` linking to `/apply?intent=plus...` and `See the full plan →` linking to `/curated/{slug}`) with a SINGLE primary CTA per card: `Plan your {city} →` linking to `/curated/{slug}`. Keep the same visual treatment (filled marketing-coral, mono-cap, hover state). Remove the secondary CTA element entirely.

- [ ] **Step 2: Commit**

```bash
git add src/components/marketing/DepartureBoard.tsx
git commit -m "feat(teaser): collapse DepartureBoard cards to one CTA per card"
```

### Task 1.15: Wire Vercel BotID on form submit

**Files:**
- Modify: `src/components/marketing/curated/TeaserForm.tsx`
- Modify: `src/lib/actions/teaser.ts`

- [ ] **Step 1: Install BotID**

```bash
pnpm add @vercel/botid
```

- [ ] **Step 2: Add token capture in form**

In `TeaserForm.tsx` (client portion):

```tsx
import { useBotid } from "@vercel/botid/react";

// inside component:
const { token } = useBotid();

// include token in form data on submit:
<input type="hidden" name="botid_token" value={token ?? ""} />
```

- [ ] **Step 3: Verify in server action**

In `submitTeaserForm` (server action), before any DB write:

```ts
import { verifyToken } from "@vercel/botid";

// after parsing input, before rate-limit check:
const botToken = (rawInput as { botid_token?: string }).botid_token;
if (botToken) {
  const verification = await verifyToken(botToken);
  if (!verification.isHuman) {
    return { ok: false, error: "Bot detection failed. Try again." };
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/marketing/curated/TeaserForm.tsx src/lib/actions/teaser.ts
git commit -m "feat(teaser): vercel BotID on form submit"
```

### Task 1.14: E2E test for Phase 1

**Files:**
- Create: `tests/e2e/curated-teaser-phase1.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("curated teaser — phase 1", () => {
  test("cold visitor sees gate view (no schedule/stays/flights)", async ({ page }) => {
    await page.goto("/curated/bali");
    await expect(page.getByRole("heading", { name: /Bali/ })).toBeVisible();
    await expect(page.getByText(/See my Bali/i)).toBeVisible();
    await expect(page.getByText(/Day 1/)).not.toBeVisible(); // schedule hidden
  });

  test("axe — gate view has no a11y violations", async ({ page }) => {
    await page.goto("/curated/bali");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("submitting form transitions to personalised view", async ({ page }) => {
    await page.goto("/curated/bali");
    await page.getByLabel(/origin/i).fill("MAN");
    await page.getByRole("button", { name: "5–6" }).click();
    await page.getByRole("button", { name: "a week" }).click();
    await page.getByRole("button", { name: /£1,500/ }).click();
    await page.getByLabel(/email/i).fill(`teaser-test-${Date.now()}@example.com`);
    await page.getByRole("button", { name: /See my Bali/i }).click();

    await expect(page.getByText(/DRAFT PREVIEW/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: /Apply to unlock/i })).toBeVisible();
  });

  test("returning visit (with cookie) renders personalised view directly", async ({
    page,
    context,
  }) => {
    // Submit once
    await page.goto("/curated/bali");
    // ... fill and submit ...
    // Then reload
    await page.reload();
    await expect(page.getByText(/DRAFT PREVIEW/)).toBeVisible();
  });

  test("rate limit kicks in after 2 submissions from same ip", async ({ page }) => {
    // ... two submissions from the same browser-context (same ip) ...
    // The third attempt should show RateLimitedNotice
    await expect(page.getByText(/already started two drafts/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test against dev**

```bash
pnpm dev &
pnpm test tests/e2e/curated-teaser-phase1.spec.ts
```

Expected: all 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/curated-teaser-phase1.spec.ts
git commit -m "test(teaser): phase 1 e2e + axe coverage"
```

### 🚢 Phase 1 Ship Checkpoint

**Acceptance criteria for Phase 1:**

- [ ] Visiting `/curated/bali` cold shows gate view (hero + typical-spec strip + form, no plan content)
- [ ] Submitting valid inputs renders personalised view within 5s (cache miss) or instantly (cache hit)
- [ ] `draft_leads` row is persisted with `teaser` populated
- [ ] Day-0 confirmation email arrives within 60s
- [ ] Returning visit with `tc_draft_id` cookie skips the form
- [ ] Resume link from email re-attaches cookie and shows personalised view on a new device
- [ ] Third submission from same IP shows rate-limit notice linking to `/apply`
- [ ] Apply CTAs at the bottom of personalised view link to `/apply?draft={id}` and `/curated/{slug}/founding-checkout?draft={id}` (stubs in this phase)
- [ ] DepartureBoard carousel has one CTA per card pointing to `/curated/{slug}`
- [ ] Playwright + axe smoke clean

Once all green, rebase + push:

```bash
git push origin feat/curated-teaser-phase1
```

Open PR. Review. Merge to main. Vercel deploys.

---

## Phase 2: Founding Fast Lane

**Ships:** `Claim a founding spot →` actually works end-to-end. Atomic 500-seat reservation with 15-min hold, Stripe Checkout for £179/yr, webhook on `payment_intent.succeeded` consumes the reservation, provisions the user's profile, and creates their first trip pre-seeded with draft data.

### Task 2.1: Add `founding_reservations` migration

**Files:**
- Create: `supabase/migrations/20260430000100_founding_reservations.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 20260430000100_founding_reservations.sql
-- Atomic 500-seat reservation for the Founding tier.
-- Each row is either an active hold (consumed=false, expires_at > now())
-- or a consumed seat (consumed=true). Aggregating both gives the total
-- "claimed" count.

create table if not exists founding_reservations (
  id uuid primary key default gen_random_uuid(),
  draft_lead_id uuid references draft_leads(id) on delete set null,
  application_id uuid references applications(id) on delete set null,
  expires_at timestamptz not null,
  consumed boolean not null default false,
  stripe_session_id text,
  created_at timestamptz not null default now()
);

create index founding_reservations_active_idx on founding_reservations (expires_at)
  where consumed = false;
create index founding_reservations_session_idx on founding_reservations (stripe_session_id)
  where stripe_session_id is not null;

alter table founding_reservations enable row level security;
-- No policies: service-role only.

create or replace function reserve_founding_seat(p_draft_lead_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_held integer;
  v_reservation_id uuid;
begin
  -- Lock against concurrent inserts
  perform pg_advisory_xact_lock(hashtext('founding_reservation'));

  select count(*) into v_held
  from founding_reservations
  where consumed = true
     or (consumed = false and expires_at > now());

  if v_held >= 500 then
    return null;
  end if;

  insert into founding_reservations (draft_lead_id, expires_at)
  values (p_draft_lead_id, now() + interval '15 minutes')
  returning id into v_reservation_id;

  return v_reservation_id;
end;
$$;

revoke all on function reserve_founding_seat(uuid) from public, anon, authenticated;
```

- [ ] **Step 2: Apply and verify**

```bash
pnpm supabase db reset
pnpm supabase db psql -- -c "\d founding_reservations"
pnpm supabase db psql -- -c "\df reserve_founding_seat"
```

Expected: table + function exist.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260430000100_founding_reservations.sql
git commit -m "feat(teaser): founding_reservations table + atomic reserve_founding_seat function"
```

### Task 2.2: Add `claimFoundingSeat` server action

**Files:**
- Create: `src/lib/actions/foundingReservation.ts`
- Test: `src/lib/actions/__tests__/foundingReservation.test.ts`

- [ ] **Step 1: Write the failing test (race condition coverage)**

```ts
// src/lib/actions/__tests__/foundingReservation.test.ts
import { describe, it, expect } from "vitest";
import { claimFoundingSeat, foundingSeatsRemaining } from "../foundingReservation";

describe("claimFoundingSeat", () => {
  it("returns reservation_id when seats remain", async () => {
    // integration test against test DB with 0 holds
    const result = await claimFoundingSeat("<draft-lead-id>");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.reservationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns sold_out when 500 seats are held", async () => {
    // setup: insert 500 active holds
    // assert: result.ok === false && result.error === 'sold_out'
  });

  it("handles concurrent claims atomically (no oversell)", async () => {
    // Race: 600 concurrent calls when 5 seats remain
    // Assert: exactly 5 succeed, 595 return sold_out
    const promises = Array.from({ length: 600 }).map(() => claimFoundingSeat("<id>"));
    const results = await Promise.all(promises);
    const succeeded = results.filter((r) => r.ok).length;
    expect(succeeded).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: Implement `claimFoundingSeat`**

```ts
// src/lib/actions/foundingReservation.ts
"use server";

import { createServiceClient } from "@/lib/supabase/server";

export type ClaimFoundingSeatResult =
  | { ok: true; reservationId: string }
  | { ok: false; error: "sold_out" | "invalid_draft" | "internal" };

export async function claimFoundingSeat(
  draftLeadId: string,
): Promise<ClaimFoundingSeatResult> {
  const supabase = createServiceClient();

  const { data: draft } = await supabase
    .from("draft_leads")
    .select("id")
    .eq("id", draftLeadId)
    .maybeSingle();
  if (!draft) return { ok: false, error: "invalid_draft" };

  const { data, error } = await supabase.rpc("reserve_founding_seat", {
    p_draft_lead_id: draftLeadId,
  });
  if (error) {
    console.error("reserve_founding_seat failed", error);
    return { ok: false, error: "internal" };
  }
  if (!data) return { ok: false, error: "sold_out" };

  return { ok: true, reservationId: data };
}

export async function foundingSeatsRemaining(): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("founding_reservations")
    .select("*", { count: "exact", head: true })
    .or(
      `consumed.eq.true,and(consumed.eq.false,expires_at.gt.${new Date().toISOString()})`,
    );
  return Math.max(0, 500 - (count ?? 0));
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm exec vitest run src/lib/actions/__tests__/foundingReservation.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/foundingReservation.ts src/lib/actions/__tests__/foundingReservation.test.ts
git commit -m "feat(teaser): claimFoundingSeat action with atomic seat reservation"
```

### Task 2.3: Build founding-checkout page UI

**REQUIRED SUB-SKILL:** `frontend-design`.

**Files:**
- Create: `src/app/(public)/curated/[slug]/founding-checkout/page.tsx`
- Create: `src/components/marketing/curated/FoundingCheckoutHold.tsx`

- [ ] **Step 1: Use frontend-design**

Invoke with brief:

> Build a server component page at `/curated/[slug]/founding-checkout?draft={id}` that:
> 1. Reads the `draft` param, resolves the draft from `draft_leads`, validates ownership via `tc_draft_id` cookie OR resume token
> 2. Calls `claimFoundingSeat(draftLeadId)`. On `sold_out`, render a sold-out state. On `invalid_draft`, render an error state. On success, render the `FoundingCheckoutHold` component.
> 3. **FoundingCheckoutHold.tsx**: Takes `reservationId`, `expiresAt`, `draftId` props. Renders:
>    - Mono-cap eyebrow `FOUNDING SPOT · HELD`
>    - Serif "Your founding spot is held for 15 minutes."
>    - 4-cell strip showing the trip name, their crew, dates, founding price
>    - 15-minute countdown timer (client component, JS-driven, useEffect setInterval)
>    - Big filled-coral CTA `Pay £179 / year →` calling a `createFoundingCheckoutSession(reservationId)` server action that returns a Stripe Checkout URL
>    - Small text below CTA: "Price-locked for life. Refunds available within 14 days."
>
> Aesthetic: editorial-brutalist, matches the personalised-view tone but more transactional.

- [ ] **Step 2: Add `createFoundingCheckoutSession` server action**

In `src/lib/actions/subscription.ts` (existing file), add:

```ts
export async function createFoundingCheckoutSession(
  reservationId: string,
): Promise<{ url: string } | { error: string }> {
  const supabase = createServiceClient();

  const { data: reservation } = await supabase
    .from("founding_reservations")
    .select("id, expires_at, consumed, draft_lead_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation || reservation.consumed) {
    return { error: "Reservation expired or already used." };
  }
  if (new Date(reservation.expires_at) < new Date()) {
    return { error: "Reservation expired." };
  }

  const { data: draft } = await supabase
    .from("draft_leads")
    .select("email")
    .eq("id", reservation.draft_lead_id)
    .single<{ email: string }>();

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: draft.email,
    line_items: [{ price: process.env.STRIPE_FOUNDING_PRICE_ID!, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/curated/${draft.slug}`,
    metadata: {
      kind: "founding",
      reservation_id: reservationId,
      draft_lead_id: reservation.draft_lead_id,
    },
  });

  // Persist session id on reservation
  await supabase
    .from("founding_reservations")
    .update({ stripe_session_id: session.id })
    .eq("id", reservationId);

  return { url: session.url! };
}
```

- [ ] **Step 3: Add `STRIPE_FOUNDING_PRICE_ID` to env**

```bash
vercel env add STRIPE_FOUNDING_PRICE_ID
```

(Founding price ID from the Stripe dashboard.)

- [ ] **Step 4: Commit**

```bash
git add src/app/\(public\)/curated/\[slug\]/founding-checkout/ src/components/marketing/curated/FoundingCheckoutHold.tsx src/lib/actions/subscription.ts
git commit -m "feat(teaser): founding checkout page with seat-hold timer + Stripe init"
```

### Task 2.4: Stripe webhook — consume reservation + create first trip

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Add Founding-tier handling on `checkout.session.completed`**

In the webhook switch statement, add a case for `checkout.session.completed`:

```ts
case "checkout.session.completed": {
  const session = event.data.object as Stripe.Checkout.Session;
  const kind = session.metadata?.kind;

  if (kind === "founding") {
    await handleFoundingCheckoutCompleted(session);
  }
  break;
}
```

- [ ] **Step 2: Add `handleFoundingCheckoutCompleted`**

```ts
async function handleFoundingCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = createServiceClient();
  const reservationId = session.metadata?.reservation_id;
  const draftLeadId = session.metadata?.draft_lead_id;
  if (!reservationId || !draftLeadId) {
    console.error("founding checkout missing metadata", session.id);
    return;
  }

  // 1. Consume reservation
  await supabase
    .from("founding_reservations")
    .update({ consumed: true })
    .eq("id", reservationId);

  // 2. Get draft data
  const { data: draft } = await supabase
    .from("draft_leads")
    .select("*")
    .eq("id", draftLeadId)
    .single<DraftLead>();

  if (!draft) {
    console.error("founding checkout draft not found", draftLeadId);
    return;
  }

  // 3. Provision profile (or look up existing by email)
  const profile = await provisionProfileForCheckout({
    email: draft.email,
    customerId: session.customer as string,
    isFoundingMember: true,
  });

  // 4. Create first trip pre-seeded
  await createFirstTripFromDraft(profile.id, draft);

  // 5. Send magic-link login email
  await sendMagicLink(draft.email);
}
```

(Helpers `provisionProfileForCheckout`, `createFirstTripFromDraft`, `sendMagicLink` are extracted into `src/lib/auth/checkoutProvisioning.ts` — see next task.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts
git commit -m "feat(teaser): stripe webhook handler for founding checkout completion"
```

### Task 2.5: Checkout provisioning helpers

**Files:**
- Create: `src/lib/auth/checkoutProvisioning.ts`

- [ ] **Step 1: Implement helpers**

```ts
// src/lib/auth/checkoutProvisioning.ts
import { createServiceClient } from "@/lib/supabase/server";
import type { DraftLead } from "@/lib/types";

export async function provisionProfileForCheckout(params: {
  email: string;
  customerId: string;
  isFoundingMember: boolean;
}): Promise<{ id: string; isNew: boolean }> {
  const supabase = createServiceClient();

  // 1. Try to find existing auth user by email
  const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const match = existing.users.find(
    (u) => u.email?.toLowerCase() === params.email.toLowerCase(),
  );

  let userId: string;
  let isNew = false;

  if (match) {
    userId = match.id;
  } else {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: params.email,
      email_confirm: true,
    });
    if (error || !created.user) {
      throw new Error(`createUser failed: ${error?.message}`);
    }
    userId = created.user.id;
    isNew = true;
  }

  // 2. Upsert profile
  await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        stripe_customer_id: params.customerId,
        stripe_subscription_status: "active",
        is_founder: params.isFoundingMember || undefined,
      },
      { onConflict: "id" },
    );

  return { id: userId, isNew };
}

export async function createFirstTripFromDraft(
  userId: string,
  draft: DraftLead,
): Promise<{ id: string }> {
  const supabase = createServiceClient();

  // Avoid double-creating: check if user has a trip linked to this draft
  const { data: existing } = await supabase
    .from("trips")
    .select("id")
    .eq("admin_user_id", userId)
    .eq("meta->>draft_lead_id", draft.id)
    .maybeSingle<{ id: string }>();
  if (existing) return existing;

  const slug = `${draft.slug}-${draft.id.slice(0, 6)}`;

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      admin_user_id: userId,
      slug,
      city_label: draft.slug.charAt(0).toUpperCase() + draft.slug.slice(1),
      status: "planning",
      currency: "GBP",
      target_crew_size: parseCrewSize(draft.inputs.crew),
      target_budget_pp: parseBudget(draft.inputs.budget),
      meta: {
        draft_lead_id: draft.id,
        ai_preferences: {
          origin: draft.inputs.origin,
          when: draft.inputs.when,
        },
      },
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !trip) throw new Error(`createFirstTripFromDraft failed: ${error?.message}`);

  // Add user as admin member
  await supabase.from("trip_members").insert({
    trip_id: trip.id,
    user_id: userId,
    role: "admin",
  });

  return trip;
}

function parseCrewSize(crew: DraftLead["inputs"]["crew"]): number {
  return crew === "2" ? 2 : crew === "3-4" ? 4 : crew === "5-6" ? 6 : 8;
}

function parseBudget(budget: DraftLead["inputs"]["budget"]): number {
  return budget === "2000+" ? 2500 : Number(budget);
}

export async function sendMagicLink(email: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/profile?from=checkout`,
    },
  });
  // generateLink doesn't auto-send; if existing infra has a sender, route the link through it.
  // Otherwise, use signInWithOtp:
  await supabase.auth.signInWithOtp({ email });
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/checkoutProvisioning.ts
git commit -m "feat(teaser): provision profile + first trip from draft after checkout"
```

### Task 2.6: E2E test — Founding fast lane

**Files:**
- Create: `tests/e2e/curated-teaser-phase2.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from "@playwright/test";

test.describe("curated teaser — phase 2 founding fast lane", () => {
  test.skip(
    !process.env.STRIPE_SECRET_KEY,
    "requires Stripe test mode configured",
  );

  test("claim a founding spot from personalised view", async ({ page }) => {
    await page.goto("/curated/bali");
    // ... fill form, submit ...
    await page.getByRole("link", { name: /Claim a founding spot/i }).click();
    await page.waitForURL(/\/curated\/bali\/founding-checkout/);
    await expect(page.getByText(/FOUNDING SPOT · HELD/)).toBeVisible();
    await expect(page.getByText(/15:00|14:5\d/)).toBeVisible(); // countdown started
    await expect(page.getByRole("button", { name: /Pay £179/ })).toBeVisible();
  });

  test("sold-out state when seats exhausted", async ({ page }) => {
    // requires test DB with 500 holds
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/curated-teaser-phase2.spec.ts
git commit -m "test(teaser): phase 2 e2e (founding fast lane)"
```

### 🚢 Phase 2 Ship Checkpoint

**Acceptance criteria for Phase 2:**

- [ ] Click `Claim a founding spot →` from personalised view → reservation created → land on hold page with 15-min timer
- [ ] Click `Pay £179 / year →` → Stripe Checkout opens (test mode acceptable)
- [ ] Test-mode payment success fires webhook → reservation marked consumed
- [ ] Webhook creates `profiles` row with `is_founder = true`, `stripe_subscription_status = active`
- [ ] Webhook creates trip in `trips` table with admin user, pre-seeded slug + crew + budget
- [ ] User in `trip_members` as admin
- [ ] Magic-link email arrives; clicking lands user on `/profile`, then `/`, where their first trip is visible
- [ ] Concurrent calls at the 500-seat boundary do not oversell (verified by integration test)

Once green, push + PR + merge.

---

## Phase 3: Crew Plus Real Review Window

**Ships:** Click `Apply to unlock the full plan →` from personalised view → reshaped `/apply` form (skips email, asks 4 ICP questions) → application persisted with `provisional_decision` and `auto_decision_at = now() + 24h` → admin queue UI surfaces the application alongside its draft + provisional decision → admin can approve/reject (immediately fires the decision email + Stripe Checkout link if approved) → cron auto-finalises after 24h if admin doesn't act.

### Task 3.1: Add applications-review-columns migration

**Files:**
- Create: `supabase/migrations/20260430000200_applications_review_columns.sql`

- [ ] **Step 1: Write migration**

```sql
-- 20260430000200_applications_review_columns.sql

alter table applications
  add column if not exists draft_lead_id uuid references draft_leads(id) on delete set null,
  add column if not exists provisional_decision text check (provisional_decision in ('approve', 'reject')),
  add column if not exists auto_decision_at timestamptz,
  add column if not exists decision_finalised_at timestamptz,
  add column if not exists decision_finalised_by text check (decision_finalised_by in ('admin', 'cron')),
  add column if not exists rejected_at timestamptz;

create index if not exists applications_pending_decision_idx on applications (auto_decision_at)
  where auto_decision_at is not null and decision_finalised_at is null;
create index if not exists applications_draft_lead_idx on applications (draft_lead_id)
  where draft_lead_id is not null;
```

- [ ] **Step 2: Apply + verify + commit**

```bash
pnpm supabase db reset
pnpm supabase db psql -- -c "\d applications"
git add supabase/migrations/20260430000200_applications_review_columns.sql
git commit -m "feat(teaser): applications review-window columns"
```

### Task 3.2: Compute heuristic + persist provisional_decision in submitApplication

**Files:**
- Modify: `src/lib/actions/applications.ts`

- [ ] **Step 1: Add heuristic computation**

```ts
import { computeProvisionalDecision } from "@/lib/applications/heuristic";

// inside submitApplication:
const provisional = computeProvisionalDecision({
  trips_per_year: parsed.data.trips_per_year,
  role: parsed.data.role,
  pain: parsed.data.pain,
  budget_attitude: parsed.data.budget_attitude,
  email: parsed.data.email,
});

const draftLeadId = parsed.data.draft_lead_id ?? null;

await supabase.from("applications").insert({
  // ... existing fields ...
  draft_lead_id: draftLeadId,
  provisional_decision: provisional,
  auto_decision_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
});
```

- [ ] **Step 2: Create heuristic module**

```ts
// src/lib/applications/heuristic.ts
import type {
  ApplicationRole,
  ApplicationPain,
  ApplicationBudgetAttitude,
  ApplicationTripsPerYear,
} from "@/lib/types";

const VALID_ROLES: ApplicationRole[] = ["organiser", "attendee", "depends"];
const VALID_PAINS: ApplicationPain[] = ["dates", "booking", "money", "plan", "chaos"];
const VALID_ATTITUDES: ApplicationBudgetAttitude[] = ["monopoly", "splurge", "count", "depends"];

export function computeProvisionalDecision(input: {
  trips_per_year: ApplicationTripsPerYear;
  role: ApplicationRole;
  pain: ApplicationPain;
  budget_attitude: ApplicationBudgetAttitude;
  email: string;
}): "approve" | "reject" {
  let score = 0;
  if (input.trips_per_year !== "0") score += 1;
  if (VALID_ROLES.includes(input.role)) score += 1;
  if (VALID_PAINS.includes(input.pain)) score += 1;
  if (VALID_ATTITUDES.includes(input.budget_attitude)) score += 1;
  if (looksLikeRealEmail(input.email)) score += 1;
  return score >= 4 ? "approve" : "reject";
}

function looksLikeRealEmail(email: string): boolean {
  const SUSPICIOUS = ["mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com"];
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  if (SUSPICIOUS.includes(domain)) return false;
  return true;
}
```

- [ ] **Step 3: Update validator to accept `draft_lead_id`**

In `src/lib/validators/application.ts`, extend the schema:

```ts
draft_lead_id: z.string().uuid().nullish(),
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/applications.ts src/lib/applications/heuristic.ts src/lib/validators/application.ts
git commit -m "feat(teaser): provisional decision heuristic on application submit"
```

### Task 3.3: Reshape /apply to skip email when draft cookie present

**REQUIRED SUB-SKILL:** `frontend-design`.

**Files:**
- Modify: `src/app/(public)/apply/page.tsx`
- Modify: `src/components/marketing/ApplicationForm.tsx`

- [ ] **Step 1: Use frontend-design**

Invoke with brief:

> Modify `src/app/(public)/apply/page.tsx` to:
> 1. Read a `draft` query param. If present, look up the draft via `readDraftFromCookie` or by validating the draft id exists in `draft_leads`. If draft found, the form should skip the email field (use draft.email automatically on submit) and pass `draftLeadId` to the form component.
> 2. The eyebrow on the page should change when a draft is present: from `Application · 5 quick questions · 90 seconds` to `Application · 4 questions · 60 seconds`.
> 3. The h1 should stay `Tell us about your crew.` in both cases.
>
> Modify `src/components/marketing/ApplicationForm.tsx` to:
> 1. Accept optional `draftLeadId: string | null` and `prefilledEmail: string | null` props
> 2. When `prefilledEmail` is present, hide the email input and pass the value through on submit
> 3. When `draftLeadId` is present, include it in the form submission payload
>
> Aesthetic stays editorial-brutalist; just hide the email field when prefilled, no other visual changes.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(public\)/apply/page.tsx src/components/marketing/ApplicationForm.tsx
git commit -m "feat(teaser): /apply skips email when arriving with a draft"
```

### Task 3.4: Send Application Received email

**Files:**
- Modify: `src/lib/email/teaserEmails.ts`
- Modify: `src/lib/actions/applications.ts`

- [ ] **Step 1: Add `sendApplicationReceived`**

```ts
// in src/lib/email/teaserEmails.ts
export async function sendApplicationReceived(params: {
  email: string;
  draftSlug?: string | null;
}) {
  const tier = "Crew Plus";
  await sendTransactionalEmail({
    to: params.email,
    subject: `We got your ${tier} application for Cohort 01.`,
    text: [
      `We got your ${tier} application for Cohort 01.`,
      ``,
      `We're reviewing — expect a decision in your inbox within 24 hours.`,
      ``,
      `Don't want to wait? Skip the queue with a founding spot. £179/year, price-locked for life, 500 limited:`,
      `${ORIGIN}/curated/${params.draftSlug ?? "bali"}/founding-checkout`,
      ``,
      `— Tripcrew`,
    ].join("\n"),
  });
}
```

- [ ] **Step 2: Fire it from `submitApplication`**

After successful insert, fire the email (don't block on failure):

```ts
void sendApplicationReceived({
  email: parsed.data.email,
  draftSlug: draft?.slug ?? null,
}).catch(console.error);
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/email/teaserEmails.ts src/lib/actions/applications.ts
git commit -m "feat(teaser): application-received email with skip-the-queue upsell"
```

### Task 3.5: Build the post-submit `/apply` confirmation state

**REQUIRED SUB-SKILL:** `frontend-design`.

**Files:**
- Create: `src/app/(public)/curated/[slug]/applied/page.tsx`
- Create: `src/components/marketing/curated/SkipTheQueueUpsell.tsx`

- [ ] **Step 1: Use frontend-design**

Invoke with brief:

> Build a server-rendered confirmation page at `/curated/[slug]/applied?application={id}`:
>
> - Mono-cap eyebrow `APPLICATION RECEIVED`
> - Serif h1: `You'll hear within 24 hours.`
> - Body paragraph: "We got your Crew Plus application for Cohort 01. We're reviewing — expect a decision in your inbox within 24 hours."
> - Below: SkipTheQueueUpsell component
>
> **SkipTheQueueUpsell.tsx**: 2-column block. Left: serif `Don't want to wait?` + body "Skip the queue with a founding spot." Right: filled-coral CTA `Claim a founding spot →` linking to `/curated/{slug}/founding-checkout?draft={draftId}`. Below CTA: "£179/year · price-locked for life · 500 limited."
>
> Modify `submitApplication`'s success return path to redirect to this page (or have the form's `useFormState` handler navigate there).

- [ ] **Step 2: Commit**

```bash
git add src/app/\(public\)/curated/\[slug\]/applied/ src/components/marketing/curated/SkipTheQueueUpsell.tsx
git commit -m "feat(teaser): application-received confirmation page with founding upsell"
```

### Task 3.6: Add admin approve/reject email triggers

**Files:**
- Modify: `src/lib/actions/approveApplication.ts`
- Modify: `src/lib/actions/rejectApplication.ts`
- Modify: `src/lib/email/teaserEmails.ts`

- [ ] **Step 1: Add `sendApplicationApproved` and `sendApplicationSoftRejected`**

```ts
// in src/lib/email/teaserEmails.ts
export async function sendApplicationApproved(params: {
  email: string;
  applicationId: string;
}) {
  const checkoutUrl = `${ORIGIN}/api/applications/${params.applicationId}/checkout`;
  await sendTransactionalEmail({
    to: params.email,
    subject: `You're in. Crew Plus, Cohort 01.`,
    text: [
      `You're in.`,
      ``,
      `Activate your Crew Plus subscription here: ${checkoutUrl}`,
      ``,
      `One admin pays. The whole crew gets in. £9/month.`,
      ``,
      `— Tripcrew`,
    ].join("\n"),
  });
}

export async function sendApplicationSoftRejected(params: { email: string }) {
  await sendTransactionalEmail({
    to: params.email,
    subject: `An update on your Crew Plus application.`,
    text: [
      `Thanks for applying to Tripcrew.`,
      ``,
      `We're matching applicants in waves. You're queued for the next one — we'll be in touch when there's space.`,
      ``,
      `In the meantime, a founding spot still skips the queue: ${ORIGIN}/#pricing`,
      ``,
      `— Tripcrew`,
    ].join("\n"),
  });
}
```

- [ ] **Step 2: Fire from approve/reject actions**

In `approveApplication.ts`, after successful approval:

```ts
await supabase
  .from("applications")
  .update({
    decision_finalised_at: new Date().toISOString(),
    decision_finalised_by: "admin",
  })
  .eq("id", applicationId);

void sendApplicationApproved({
  email: application.email,
  applicationId,
}).catch(console.error);
```

In `rejectApplication.ts`, similarly:

```ts
await supabase
  .from("applications")
  .update({
    rejected_at: new Date().toISOString(),
    decision_finalised_at: new Date().toISOString(),
    decision_finalised_by: "admin",
  })
  .eq("id", applicationId);

void sendApplicationSoftRejected({ email: application.email }).catch(console.error);
```

- [ ] **Step 3: Add Crew Plus checkout endpoint**

```ts
// src/app/api/applications/[id]/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: app } = await supabase
    .from("applications")
    .select("id, email, approved_at, draft_lead_id")
    .eq("id", id)
    .maybeSingle();

  if (!app || !app.approved_at) {
    return new NextResponse("Application not approved.", { status: 400 });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: app.email,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/`,
    metadata: {
      kind: "crew_plus",
      application_id: id,
      draft_lead_id: app.draft_lead_id ?? "",
    },
  });

  return NextResponse.redirect(session.url!);
}
```

- [ ] **Step 4: Update Stripe webhook to handle Crew Plus checkout**

In `src/app/api/stripe/webhook/route.ts`, add:

```ts
async function handleCrewPlusCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = createServiceClient();
  const applicationId = session.metadata?.application_id;
  const draftLeadId = session.metadata?.draft_lead_id || null;
  if (!applicationId) {
    console.error("crew plus checkout missing application_id", session.id);
    return;
  }

  const { data: app } = await supabase
    .from("applications")
    .select("email")
    .eq("id", applicationId)
    .single<{ email: string }>();

  // Provision profile
  const profile = await provisionProfileForCheckout({
    email: app.email,
    customerId: session.customer as string,
    isFoundingMember: false,
  });

  // Create first trip if draft is linked
  if (draftLeadId) {
    const { data: draft } = await supabase
      .from("draft_leads")
      .select("*")
      .eq("id", draftLeadId)
      .single<DraftLead>();
    if (draft) {
      await createFirstTripFromDraft(profile.id, draft);
    }
  }

  // Mark application paid
  await supabase
    .from("applications")
    .update({
      first_paid_at: new Date().toISOString(),
      user_id: profile.id,
    })
    .eq("id", applicationId);

  // Magic link
  await sendMagicLink(app.email);
}
```

In the switch's `checkout.session.completed` case, dispatch on kind:

```ts
if (kind === "founding") await handleFoundingCheckoutCompleted(session);
else if (kind === "crew_plus") await handleCrewPlusCheckoutCompleted(session);
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/approveApplication.ts src/lib/actions/rejectApplication.ts src/lib/email/teaserEmails.ts src/app/api/applications/ src/app/api/stripe/webhook/route.ts
git commit -m "feat(teaser): admin approve/reject emails + crew plus checkout flow"
```

### Task 3.7: Update admin queue UI to show provisional decision + draft

**REQUIRED SUB-SKILL:** `frontend-design`.

**Files:**
- Modify: `src/app/(app)/admin/applications/queue/page.tsx`
- Modify: `src/app/(app)/admin/applications/[id]/page.tsx`

- [ ] **Step 1: Use frontend-design**

Invoke with brief:

> Update the existing admin queue UI in `src/app/(app)/admin/applications/queue/page.tsx` and `[id]/page.tsx` to show:
>
> Queue page (list view):
> - Add a column showing the `provisional_decision` value as a small mono-cap chip ("PROVISIONAL · APPROVE" or "PROVISIONAL · REJECT") next to each row
> - Add a column showing time remaining until `auto_decision_at` ("23h left" / "2h left" / "expires now")
> - Sort: pending applications by `auto_decision_at ASC` (most urgent first)
>
> Detail page:
> - Below the existing question answers, add a "Captured draft" block showing the `draft_leads.inputs` (origin / crew / when / budget / email) if `draft_lead_id` is set
> - Show the heuristic provisional decision prominently
> - Add `View their teaser →` link to the resume URL (`/curated/{slug}?resume={draft_id}&token={resume_token}`) so admin can see what the applicant saw
>
> Aesthetic continues editorial-brutalist (mono-cap labels, hairline dividers, no card backgrounds).

- [ ] **Step 2: Commit**

```bash
git add src/app/\(app\)/admin/applications/
git commit -m "feat(teaser): admin queue shows provisional decision + draft data"
```

### Task 3.8: Cron — finalise applications past auto_decision_at

**Files:**
- Create: `src/app/api/cron/finalise-applications/route.ts`

- [ ] **Step 1: Implement cron handler**

```ts
// src/app/api/cron/finalise-applications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  sendApplicationApproved,
  sendApplicationSoftRejected,
} from "@/lib/email/teaserEmails";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: pending } = await supabase
    .from("applications")
    .select("id, email, provisional_decision")
    .lt("auto_decision_at", new Date().toISOString())
    .is("decision_finalised_at", null)
    .limit(100);

  if (!pending || pending.length === 0) {
    return NextResponse.json({ finalised: 0 });
  }

  let finalised = 0;
  for (const app of pending) {
    if (app.provisional_decision === "approve") {
      await supabase
        .from("applications")
        .update({
          approved_at: new Date().toISOString(),
          decision_finalised_at: new Date().toISOString(),
          decision_finalised_by: "cron",
        })
        .eq("id", app.id);
      void sendApplicationApproved({ email: app.email, applicationId: app.id }).catch(
        console.error,
      );
    } else {
      await supabase
        .from("applications")
        .update({
          rejected_at: new Date().toISOString(),
          decision_finalised_at: new Date().toISOString(),
          decision_finalised_by: "cron",
        })
        .eq("id", app.id);
      void sendApplicationSoftRejected({ email: app.email }).catch(console.error);
    }
    finalised += 1;
  }

  return NextResponse.json({ finalised });
}
```

- [ ] **Step 2: Add `CRON_SECRET` to env**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
vercel env add CRON_SECRET
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/finalise-applications/route.ts
git commit -m "feat(teaser): cron auto-finalise applications past 24h with provisional decision"
```

### Task 3.9: Add vercel.ts cron schedule

**Files:**
- Create: `vercel.ts`

- [ ] **Step 1: Install `@vercel/config` if not present**

```bash
pnpm add -D @vercel/config
```

- [ ] **Step 2: Create vercel.ts**

```ts
// vercel.ts
import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    {
      path: "/api/cron/finalise-applications",
      schedule: "*/15 * * * *", // every 15 minutes
    },
    {
      path: "/api/cron/teaser-day-7-nudge",
      schedule: "0 * * * *", // hourly
    },
  ],
};
```

- [ ] **Step 3: Commit**

```bash
git add vercel.ts package.json pnpm-lock.yaml
git commit -m "feat(teaser): vercel cron schedules for finalise + day-7 nudge"
```

### 🚢 Phase 3 Ship Checkpoint

**Acceptance criteria for Phase 3:**

- [ ] Click `Apply to unlock the full plan →` from personalised teaser → /apply with no email field
- [ ] Submit /apply with 4 ICP answers → application created with `provisional_decision` populated
- [ ] Application-received email arrives with skip-the-queue upsell
- [ ] Redirect to `/curated/[slug]/applied?application={id}` shows confirmation + upsell
- [ ] Admin queue shows provisional decision + countdown + draft data
- [ ] Admin can approve from queue → approval email fires immediately with checkout link
- [ ] Click checkout link → Stripe Checkout for £9/mo
- [ ] Test-mode payment succeeds → webhook provisions profile + creates first trip
- [ ] If admin doesn't act within 24h, cron auto-finalises with provisional decision
- [ ] Soft-rejection email arrives correctly when reject is finalised

---

## Phase 4: Day-7 Nudge Cron

**Ships:** Drip email at day 7 to leads who never applied. Includes founding-scarcity language. Marks `nudge_sent_at` so a lead receives at most one.

### Task 4.1: Cron handler — day-7 nudge

**Files:**
- Create: `src/app/api/cron/teaser-day-7-nudge/route.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/api/cron/teaser-day-7-nudge/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendDay7Nudge } from "@/lib/email/teaserEmails";
import { foundingSeatsRemaining } from "@/lib/actions/foundingReservation";
import type { DraftLead } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Find leads created > 7 days ago, not nudged, not unsubscribed,
  // and without an associated application of any status.
  const { data: candidates } = await supabase
    .from("draft_leads")
    .select("id, email, slug, resume_token")
    .lt("created_at", sevenDaysAgo)
    .is("nudge_sent_at", null)
    .is("unsubscribed_at", null)
    .limit(200);

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  // Filter out leads with any application
  const ids = candidates.map((c) => c.id);
  const { data: applied } = await supabase
    .from("applications")
    .select("draft_lead_id")
    .in("draft_lead_id", ids);
  const appliedSet = new Set((applied ?? []).map((a) => a.draft_lead_id).filter(Boolean));

  const eligible = candidates.filter((c) => !appliedSet.has(c.id));

  const remaining = await foundingSeatsRemaining();

  let sent = 0;
  for (const lead of eligible) {
    try {
      await sendDay7Nudge({
        email: lead.email,
        draftId: lead.id,
        resumeToken: lead.resume_token,
        slug: lead.slug,
        foundingRemaining: remaining,
      });
      await supabase
        .from("draft_leads")
        .update({ nudge_sent_at: new Date().toISOString() })
        .eq("id", lead.id);
      sent += 1;
    } catch (err) {
      console.error("day-7 nudge send failed for", lead.id, err);
    }
  }

  return NextResponse.json({ sent });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/teaser-day-7-nudge/route.ts
git commit -m "feat(teaser): day-7 nudge cron with founding-scarcity copy"
```

### Task 4.2: Manual e2e verification of cron

**Files:** none (manual verification)

- [ ] **Step 1: Backdate a draft_lead to > 7 days old**

```bash
pnpm supabase db psql -- -c "UPDATE draft_leads SET created_at = now() - interval '8 days' WHERE id = '<test-draft-id>';"
```

- [ ] **Step 2: Hit the cron endpoint manually**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/teaser-day-7-nudge
```

Expected: `{ "sent": 1 }`. Verify email arrives. Verify `nudge_sent_at` is now populated.

- [ ] **Step 3: Re-run the cron**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/teaser-day-7-nudge
```

Expected: `{ "sent": 0 }` — already nudged.

### Task 4.3: Cost-ceiling alert cron

**Files:**
- Create: `src/app/api/cron/teaser-cost-alert/route.ts`
- Modify: `vercel.ts`

- [ ] **Step 1: Implement the alert cron**

```ts
// src/app/api/cron/teaser-cost-alert/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAILY_LIMIT_GBP = 40; // ~$50 USD

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createServiceClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("ai_usage")
    .select("cost_gbp")
    .eq("purpose", "curated_teaser")
    .gte("created_at", since);

  const total = (data ?? []).reduce((sum, row) => sum + (row.cost_gbp ?? 0), 0);

  if (total > DAILY_LIMIT_GBP) {
    // Use existing transactional email transport
    const { sendTransactionalEmail } = await import("@/lib/email/transport");
    await sendTransactionalEmail({
      to: process.env.AI_BETA_OWNER_EMAIL!,
      subject: `[ALERT] Curated teaser cost over £${DAILY_LIMIT_GBP} in 24h`,
      text: `Total: £${total.toFixed(2)} in last 24h. Investigate ai_usage for purpose=curated_teaser.`,
    });
  }

  return NextResponse.json({ total, limit: DAILY_LIMIT_GBP, alerted: total > DAILY_LIMIT_GBP });
}
```

- [ ] **Step 2: Add to vercel.ts crons**

```ts
{
  path: "/api/cron/teaser-cost-alert",
  schedule: "0 */6 * * *", // every 6 hours
},
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/teaser-cost-alert/ vercel.ts
git commit -m "feat(teaser): cost-ceiling alert cron at £40/24h"
```

### 🚢 Phase 4 Ship Checkpoint

**Acceptance criteria:**

- [ ] Cron fires hourly, scans for eligible leads, sends day-7 nudge
- [ ] Each lead receives at most one nudge (`nudge_sent_at` enforces)
- [ ] Leads with any `applications` row are excluded
- [ ] Unsubscribed leads are excluded
- [ ] Nudge email contains accurate `foundingSeatsRemaining` count
- [ ] Unsubscribe link in nudge works

---

## Final Acceptance Criteria (mapped to spec section 11)

- [ ] **Spec criterion 1** ✓ Phase 1 Task 1.11 — gate view renders pre-submit
- [ ] **Spec criterion 2** ✓ Phase 1 Task 1.6 — submit produces teaser within 5s / instantly on cache hit
- [ ] **Spec criterion 3** ✓ Phase 1 Task 1.6 — rate-limit message after 2 IP draft_leads
- [ ] **Spec criterion 4** ✓ Phase 1 Task 1.11 — cookie returns to personalised view
- [ ] **Spec criterion 5** ✓ Phase 1 Task 1.7 — day-0 email + resume link
- [ ] **Spec criterion 6** ✓ Phase 2 Tasks 2.2–2.5 — founding seat reservation + Stripe + first trip
- [ ] **Spec criterion 7** ✓ Phase 3 Tasks 3.2–3.3 — /apply skips email, persists draft_lead_id, provisional_decision, auto_decision_at
- [ ] **Spec criterion 8** ✓ Phase 3 Task 3.6 — admin approve fires email + checkout link
- [ ] **Spec criterion 9** ✓ Phase 3 Task 3.8 — cron auto-finalises after 24h
- [ ] **Spec criterion 10** ✓ Phase 2 Tasks 2.4–2.5 + Phase 3 Task 3.6 — Stripe webhook → first trip created
- [ ] **Spec criterion 11** ✓ Phase 4 — day-7 nudge cron

---

## Testing summary

**Unit / integration:**
- `src/lib/ai/__tests__/teaserSchema.test.ts` — Zod schema length-locks to 2 days, rejects invalid shapes
- `src/lib/actions/__tests__/teaser.test.ts` — rate limit, cache hit, cache miss, unknown slug, valid email
- `src/lib/actions/__tests__/foundingReservation.test.ts` — single claim, sold-out, concurrent race condition

**E2E:**
- `tests/e2e/curated-teaser-phase1.spec.ts` — gate view, axe, form submission, returning visit, rate limit
- `tests/e2e/curated-teaser-phase2.spec.ts` — founding fast lane (Stripe test mode required)
- `tests/e2e/curated-teaser-phase3.spec.ts` — Crew Plus apply path (Stripe test mode required)

**Manual:**
- Day-0 confirmation email rendering across email clients (Gmail, Outlook, Apple Mail)
- Day-7 nudge cron via curl
- Admin approve/reject from queue UI

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-28-curated-teaser.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Tasks are self-contained so a fresh subagent can pick up any task with just the spec + plan.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

**Which approach?**
