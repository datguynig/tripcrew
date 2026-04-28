# Curated trip personalised teaser — design spec

**Date:** 2026-04-28
**Status:** Approved (brainstorming locked)
**Next:** Implementation plan via writing-plans skill

## Goal

Replace the cold `/apply` form leak on curated trip detail pages with a personalised teaser flow that funnels into a tier-aware conversion path. Every visitor on `/curated/[slug]` either submits the teaser form (warm lead, captured email, personalised draft saved) or bounces. No more cold visits scrolling a full plan and hitting a generic 5-question application form.

## Problem (today)

A visitor on `/curated/bali`:

1. Reads the full curated plan (hero, 9-day schedule, all stays, all flights, bookings checklist)
2. Hits the apply CTA at the bottom hot
3. Lands on `/apply` — a generic form titled "Tell us about your crew" with five questions about their role, what kills their trips, etc.
4. Submits → status `pending` → batched approval (typically 7 days) → approval email → sign-up → Stripe Checkout → empty dashboard, has to recreate trip from scratch

Two leaks:

- **Pre-application:** Visitor consumed full plan content publicly. They could feed it to Claude/ChatGPT to scale the trip themselves and skip Tripcrew entirely.
- **Post-application:** 7-day cold gap kills warm intent. Re-entering all the data on signup destroys the magic moment. The personalised draft they cared about is severed from their actual first trip.

## Solution

A two-stage flow on `/curated/[slug]`:

1. **Form-first hard gate.** Pre-submit, only hero/city/tagline/typical-spec are visible. The schedule, stays, flights, bookings — none of it shows until the visitor submits the 5-field form. 2-teaser-per-IP lifetime cap means we don't subsidise people who want a free AI trip planner.
2. **Calibrated personalised view.** After submit, show their inputs reflected back as a personalised teaser. Show enough to prove personalisation, withhold the actionable specifics so it can't be extracted for use elsewhere. Conversion CTAs at the bottom funnel into a tier-aware apply path.

The apply path is then split:

- **Founding fast lane** — instant Stripe Checkout. Highest LTV, hard-cap scarcity self-filters, £179 upfront IS the filter.
- **Crew Plus real review window** — 3 ICP-fit questions, 24-hour real review (auto-approve heuristic with manual override capability), approval email with Stripe Checkout link.

On Stripe payment success, the user's first trip is auto-created from their captured draft data. Their first authed session lands inside an already-started Bali trip, not on empty state.

## User flow

### A. Cold visitor

1. Lands on `/curated/bali` (via homepage carousel `Plan your Bali →` CTA, or direct link)
2. Sees: hero photo + city + tagline + 4-cell typical-spec strip ("£1,500 typical · 6 typical · 9 days · LHR origin") + form
3. No schedule, stays, flights, or bookings visible. Hard gate.
4. Fills 5-field form (origin / crew / when / budget / email), submits
5. Server validates, rate-limits (lifetime cap of 2/IP), checks cache by `(slug, normalized inputs)`, calls Gemini if cache miss, persists `draft_leads` row, sets `tc_draft_id` cookie, fires day-0 confirmation email
6. Personalised view renders inline (calibration ratio defined below)
7. Two CTAs at bottom: `Apply to unlock the full plan →` (Crew Plus) + `Claim a founding spot →` (Founding)

### B. Returning visitor (cookie present, valid draft)

1. Lands on `/curated/bali`
2. Server reads `tc_draft_id` cookie, looks up draft, renders personalised view directly
3. Above the personalised view: a small `Change inputs ↺` affordance to redo the form
4. Same conversion CTAs at bottom

### C. Cross-device fallback

1. User filled the form on phone, returns on laptop (no cookie)
2. Day-0 confirmation email contains a resume link `/curated/bali?resume={draft_id}&token={signed_token}`
3. Click link → server validates token, sets cookie on this device, renders personalised view

### D. Conversion — Founding fast lane

1. Click `Claim a founding spot →`
2. Server-side: atomic seat reservation (decrement 500-counter, 15-min hold)
3. Confirmation page: "Your founding spot is held for 15 minutes" + Stripe Checkout button + 15-min countdown
4. Stripe Checkout for £179/yr Founding tier
5. Webhook on `payment_intent.succeeded`:
   - Mark reservation `consumed = true`
   - Provision `profiles` row (founder badge active)
   - Create first trip pre-seeded with draft data (city/dates/budget/crew/origin)
   - Send magic-link email
6. Click magic link → `/profile` (display name capture) → `/` dashboard with their Bali trip already in motion

### E. Conversion — Crew Plus real review window

1. Click `Apply for Crew Plus →`
2. Reshaped `/apply` form. Server detects the draft cookie/token, skips fields the teaser already captured (email, crew). Shows 3 ICP-fit questions only:
   - Trips per year (0 / 1 / 2–3 / 4+)
   - Your role in the crew (organiser / shows up / depends)
   - What stage is your crew chat at? (planning / postponed / killed)
3. Submit → row in `applications` table, status `pending`, `auto_decision_at = now() + 24 hours`. Heuristic computes `provisional_decision` immediately.
4. Page state: "Application received. You'll hear within 24 hours." Plus visible upsell: "Don't want to wait? Skip the queue with a founding spot →"
5. Day-0 confirmation email fires: "We got your Crew Plus application for Cohort 01. We're reviewing — expect a decision in your inbox within 24 hours."
6. **Manual review window:** Admin sees the application in [src/app/(app)/admin/applications/](../../src/app/(app)/admin/applications/) with provisional decision next to it and the full draft data inline. Admin can:
   - Click `Approve` → approval email fires immediately with Stripe Checkout link
   - Click `Reject` → soft-waitlist email fires ("matching in waves, queued for the next one")
   - Do nothing → at `auto_decision_at`, cron flushes the application using `provisional_decision`
7. User clicks Checkout link in approval email → Stripe Checkout for £9/mo
8. Webhook on `payment_intent.succeeded`:
   - Provision `profiles` row
   - Create first trip pre-seeded with draft data
   - Send magic-link email
9. Click magic link → `/profile` → `/` dashboard with first trip already populated

### F. Heuristic-fail fallback (Crew Plus)

If `provisional_decision = reject` (heuristic score < 3) AND admin does nothing within 24h:
- Cron sends soft-waitlist email
- Admin can still resurrect the application later by changing status manually in the admin queue

### G. Hit lifetime cap

If a visitor's IP already has 2 `draft_leads` rows:
- Form submit returns `RATE_LIMITED`
- Page state: "You've already started two drafts. To start more, apply for an invite." with link to `/apply`

## Page architecture

Single route, three states.

`/curated/[slug]` is a server component:

```ts
async function CuratedTripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = getCuratedTripBySlug(slug);
  if (!trip) notFound();

  const draftLead = await readDraftFromCookie();
  const isResumeFlow = await validateResumeToken();

  if (draftLead || isResumeFlow) {
    return <CuratedTripPersonalisedView trip={trip} draft={draftLead} />;
  }

  return <CuratedTripGateView trip={trip} />;
}
```

Pre-submit (gate state) renders:
- `<Header trip={trip} />` — hero photo + city + tagline (existing)
- `<TypicalSpecStrip trip={trip} />` — 4-cell typical-spec strip showing the curated trip's default values (per-head price, crew size, total days, origin) labelled `TYPICAL` in mono-cap to set expectations without claiming these are *yours* (NEW component, smaller version of existing SpecBlock)
- `<TeaserForm trip={trip} />` — the 5-field form (NEW)

Post-submit (personalised state) renders:
- `<Header trip={trip} draft={draft} />` — hero with personalised tagline ("Six of you, leaving MAN, 14–19 June")
- `<PersonalisedSpecGrid draft={draft} />` — their inputs reflected
- `<PersonalisedTeaser teaser={draft.teaser} />` — calibrated content (see ratio below)
- `<DraftWatermark />` — `DRAFT PREVIEW · APPLY TO UNLOCK + BOOK WITH YOUR CREW`
- `<ConversionCTAs draftId={draft.id} />` — Founding + Crew Plus CTAs

The current `ScheduleBlock`, `StaysBlock`, `FlightsBlock`, `BookingsBlock` components in [src/components/marketing/CuratedTripView.tsx](../../src/components/marketing/CuratedTripView.tsx) are **removed from public render**. They become reference data only — the AI uses the underlying [src/lib/marketing/curatedTrips.ts](../../src/lib/marketing/curatedTrips.ts) data to generate calibrated teasers.

## Calibration ratio

The personalised teaser shows enough to prove personalisation, withholds enough that it can't be extracted as a usable trip plan.

| Show | Withhold |
|---|---|
| Scaled spec grid (their crew, dates, budget, origin) | — |
| Hero paragraph ("Six of you, leaving MAN, 14–19 June, ~£1,200pp") | — |
| **2 of {totalDays}** schedule days, vibe-only descriptions | The other 7 days |
| Vibe-level day notes ("morning surf, slow lunch, sunset cliff jump") | Specific restaurants, hotels, activity providers |
| **One** stay neighbourhood + price band ("Canggu, ~£140/night") | Stay names, booking links |
| Flight price band ("MAN→DPS from ~£680pp") | Specific carriers, schedules, booking links |
| Bookings *count* ("12 things to lock") | The list itself |
| Date-specific weather/season note ("June: dry season, 28°C average") | — |

The personalisation items (their crew echoed back, their origin's flight estimate, their budget's stay band, their dates' weather note) are high-value-low-leak — they prove personalisation but aren't extractable. The actionable specifics (named restaurants, named hotels, named carriers, exact times) are withheld.

## Data model

### New table: `draft_leads`

```sql
create table public.draft_leads (
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
  created_at timestamptz default now()
);

create index draft_leads_cache_key_idx on draft_leads (cache_key);
create index draft_leads_ip_idx on draft_leads (ip_hash);
create index draft_leads_email_idx on draft_leads (email);
create index draft_leads_nudge_eligible_idx on draft_leads (created_at)
  where nudge_sent_at is null and unsubscribed_at is null;

alter table public.draft_leads enable row level security;

create policy draft_leads_anon_insert on public.draft_leads
  for insert to anon with check (true);
-- Read/update/delete: service-role only, no policy
```

`inputs` shape:
```ts
{
  origin: string,           // IATA airport code
  crew: "2" | "3-4" | "5-6" | "7+",
  when: "weekend" | "week" | "two-weeks" | "flexible",
  budget: "500" | "1000" | "1500" | "2000+"
}
```

**Note on `when`:** The form captures fuzzy windows (weekend / week / etc), not specific dates. The AI prompt grounds specific dates inside the curated trip's season window (each curated trip has an implicit "best months" range derived from `datesLabel`). Example: input `when="week"` for Bali → AI picks a plausible 7-day stretch within Bali's dry season (May–September), e.g. "14–20 June". The hero paragraph and spec grid render those AI-generated specific dates back to the visitor. Cache key normalises `when` (so `week` always produces the same dates for a given slug).

`teaser` shape (Zod-validated output of Gemini):
```ts
{
  spec: { perHead: string, crew: string, origin: string, vibes: string },
  hero_paragraph: string,
  days: Array<{ day: string, place: string, note: string }>,  // exactly 2
  stay: { neighbourhood: string, priceBand: string },
  flights: { priceBand: string },
  bookings_count: number,
  weather: string
}
```

`cache_key = sha256(slug + json(normalized_inputs))` — same inputs from same slug returns cached teaser, no fresh AI call.
`ip_hash = sha256(ip + per-env salt)` — never store raw IPs.
`resume_token` — random 32-byte hex string used in the cross-device email link.

### New table: `founding_reservations`

```sql
create table public.founding_reservations (
  id uuid primary key default gen_random_uuid(),
  draft_lead_id uuid references public.draft_leads(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  expires_at timestamptz not null,
  consumed boolean not null default false,
  created_at timestamptz default now()
);

create index founding_reservations_active_idx on public.founding_reservations (expires_at)
  where consumed = false;

alter table public.founding_reservations enable row level security;
-- No policies: service-role only
```

Atomic reservation function:
```sql
create or replace function public.reserve_founding_seat(p_draft_lead_id uuid)
returns uuid
language plpgsql
security definer
as $$
declare
  v_held integer;
  v_reservation_id uuid;
begin
  -- Count active holds + consumed seats
  select count(*) into v_held
  from public.founding_reservations
  where consumed = true or (consumed = false and expires_at > now());

  if v_held >= 500 then
    return null;
  end if;

  insert into public.founding_reservations (draft_lead_id, expires_at)
  values (p_draft_lead_id, now() + interval '15 minutes')
  returning id into v_reservation_id;

  return v_reservation_id;
end;
$$;
```

Cron at 5-min interval cleans up: nothing actually needs cleanup since `expires_at` is the source of truth — but a cron can prune `consumed=false AND expires_at < now() - 30 days` rows for table hygiene.

### Changes to existing `applications` table

Add columns:

```sql
alter table public.applications
  add column draft_lead_id uuid references public.draft_leads(id) on delete set null,
  add column provisional_decision text check (provisional_decision in ('approve', 'reject')),
  add column auto_decision_at timestamptz,
  add column decision_finalised_at timestamptz,
  add column decision_finalised_by text check (decision_finalised_by in ('admin', 'cron'));

create index applications_pending_decision_idx on public.applications (auto_decision_at)
  where status = 'pending' and decision_finalised_at is null;
```

## Heuristic for `provisional_decision`

```ts
function computeProvisionalDecision(answers: ApplicationAnswers, draft: DraftLead): "approve" | "reject" {
  let score = 0;

  if (answers.tripsPerYear >= 1) score += 1;
  if (["organiser", "shows-up", "depends"].includes(answers.role)) score += 1;
  if (["planning", "postponed", "killed"].includes(answers.chatStage)) score += 1;
  if (await emailLooksValid(draft.email)) score += 1;  // format + MX-record

  return score >= 3 ? "approve" : "reject";
}
```

Heuristic is intentionally generous — anyone who came through the personalised teaser AND answers the 3 ICP questions credibly is the right ICP by definition. The reject path exists for spam emails, abusive submissions, and genuine ICP mismatches (e.g., 0 trips/year + suspicious email).

## Anti-abuse layers

- **Lifetime rate limit:** 2 teasers per IP, hard cap. Postgres count query before AI call: `select count(*) from draft_leads where ip_hash = $1`. ≥ 2 → reject with `RATE_LIMITED` and link to `/apply`.
- **Email gate:** Form rejects without a syntactically valid email. MX-record check on submit before AI call.
- **Cache hit:** Same `(slug, normalized_inputs)` → return cached `teaser` without fresh AI call. Saves cost and prevents abuse-via-input-permutation.
- **Cost ceiling:** Daily alert on `ai_usage` rows where `purpose = 'curated_teaser'` if cumulative cost > $50. Manual investigation if triggered.
- **Bot detection:** Vercel BotID on form submit. Failures get a soft-decline ("Looks like a bot, sorry").
- **Email validation:** Format + MX-record. No disposable-email blocklist in v1 (defer to v1.1 if abuse signal arises).

## Cost model

- **Per teaser API call:** ~$0.01–0.05. Gemini 3 Flash Preview, ~3K input tokens (curated trip JSON + system prompt + user inputs) + ~2K output tokens (scaled spec + 2 days + hero paragraph). No Places API call (scale-only against existing curated data).
- **Cache hit ratio:** Should be high after first cohort. Caching by normalized inputs means common patterns (e.g., "London origin, crew of 4, week, £1500") share a single AI call across visitors.
- **Build:** ~2–3 days for v1 reusing [src/lib/ai/gemini.ts](../../src/lib/ai/gemini.ts), [src/lib/ai/prompts.ts](../../src/lib/ai/prompts.ts), [src/lib/ai/schema.ts](../../src/lib/ai/schema.ts), the airport autocomplete from [src/lib/actions/airports.ts](../../src/lib/actions/airports.ts), and existing transactional email infra.

## Email sequence (v1)

### Day 0 — confirmation (immediate)

Triggered by: `draft_leads` row insert.

Subject: `Your {City} draft is saved.`
Body:
- Echo their inputs ("Six of you, 14–19 June, ~£1,200pp from MAN")
- Resume link: `/curated/{slug}?resume={draft_id}&token={resume_token}`
- Apply CTA (links to the same `/curated/[slug]` page where they came from — cookie-driven returning visitor flow handles the rest)
- Unsubscribe link (server action `unsubscribeDraftLead({ id, token })`)

### Day 7 — founding-scarcity nudge (cron)

Triggered by: cron job runs hourly, queries:
```sql
select * from draft_leads
where created_at < now() - interval '7 days'
  and nudge_sent_at is null
  and unsubscribed_at is null
  and not exists (
    select 1 from applications
    where applications.draft_lead_id = draft_leads.id
  );
```

Exclude any lead that has applied at all — they're in a different funnel state and the day-7 message ("apply now") would be wrong for them.

Subject: `Your {City} draft + a heads-up on founding spots.`
Body:
- Founding count remaining (from `founding_reservations` aggregate)
- Deadline framing
- Apply CTA
- Mark `nudge_sent_at = now()` after send

### Crew Plus application emails (transactional, triggered by application state)

- **Application received** (immediate on `/apply` submit): "We got your Crew Plus application for Cohort 01. We're reviewing — expect a decision within 24 hours."
- **Application approved** (immediate on admin approve OR cron auto-approve): "You're in. Crew Plus, Cohort 01." + Stripe Checkout link
- **Application soft-rejected** (immediate on admin reject OR cron auto-reject): "We're matching applicants in waves. You're queued for the next one." (no specific date — keeps the lead alive)

### Founding tier (no review email)

Founding has no review window — Stripe Checkout fires directly after seat reservation. Standard Stripe receipt + welcome magic-link email is sufficient.

## Acceptance criteria

A v1 ship is acceptable when:

1. Visiting `/curated/bali` cold shows: hero + city + tagline + 4-cell typical-spec strip + 5-field form. No schedule, stays, flights, or bookings visible.
2. Submitting the form (with valid inputs and email) produces a personalised teaser within 5 seconds (cache miss) or instantly (cache hit) and persists a `draft_leads` row with `teaser` populated.
3. Submitting from an IP that already has 2 `draft_leads` rows shows the rate-limit message linking to `/apply`.
4. Returning to `/curated/bali` with the cookie set lands on the personalised view directly (no form re-fill).
5. Day-0 confirmation email arrives within 60 seconds of submit, contains correct echo of inputs and a working resume link.
6. Clicking `Claim a founding spot →` from the personalised teaser successfully reserves a seat (or returns sold-out if 500 are held), and on Stripe payment success creates a profile + first trip pre-seeded with draft data.
7. Clicking `Apply for Crew Plus →` from the personalised teaser shows the 3 ICP-fit questions (no redundant fields). Submit creates an `applications` row with `provisional_decision` populated and `auto_decision_at = now() + 24h`.
8. Admin can approve a pending application from [src/app/(app)/admin/applications/](../../src/app/(app)/admin/applications/), triggering the approval email immediately with Stripe Checkout link.
9. If admin doesn't act within 24h, cron flushes the application with the `provisional_decision`.
10. On Stripe Checkout success (either tier), webhook creates `profiles` row, creates first trip pre-seeded with draft data, fires magic-link email. User's first authed dashboard view shows their pre-started trip.
11. Day-7 founding-scarcity nudge fires for draft_leads that have not applied at all (no associated `applications` row) and have no `nudge_sent_at` timestamp.

## Out of v1 (deferred)

- Day-2 case-study email (no real customer story exists at launch — wait for v1 cohort to produce one)
- Day-14 last-touch email
- Hosted unsubscribe page (v1 uses tokenised email link → server action)
- Analytics events (form view / submit / teaser view / apply click) — instrument once core flow ships
- A/B testing the calibration ratio
- Auth-aware existing-user detection (if email matches `profiles.email`, redirect to `/sign-in`)
- Disposable-email blocklist (defer until abuse signal arises)
- Multi-language support
- Mobile-specific form layout polish (use the desktop form on mobile in v1, polish in v1.1)

## Implementation guidance

**UI components (all `src/components/marketing/curated/*` and the reshaped `/apply` form) must be built via the `frontend-design` skill.** The aesthetic baseline is the existing editorial-brutalist marketing surfaces (cream / ink / marketing-coral tokens, mono-cap eyebrows, serif display, hard 2px borders, hairline dividers). Match the tone of the existing [Hero](../../src/components/marketing/Hero.tsx), [DepartureBoard](../../src/components/marketing/DepartureBoard.tsx), and [CuratedTripView](../../src/components/marketing/CuratedTripView.tsx). No emojis, no competitor brand names, no purple gradients, no hex (Tailwind tokens only).

Non-UI work (server actions, migrations, AI prompt + schema, cron handlers, webhook updates, type additions) is implemented directly without the frontend-design skill.

## Files to create/modify

**New files:**
- `supabase/migrations/<timestamp>_draft_leads.sql`
- `supabase/migrations/<timestamp>_founding_reservations.sql`
- `supabase/migrations/<timestamp>_applications_review_columns.sql`
- `src/lib/actions/teaser.ts` — server actions for teaser generation, rate limit, cache, draft creation
- `src/lib/actions/foundingReservation.ts` — atomic reservation + Stripe checkout init
- `src/lib/ai/prompts/teaserPrompt.ts` — Gemini prompt builder for teaser generation
- `src/lib/ai/schema/teaserSchema.ts` — Zod schema for teaser output
- `src/lib/email/teaserEmails.ts` — day-0 confirmation, day-7 nudge, application transactional emails
- `src/components/marketing/curated/TeaserForm.tsx` — 5-field form
- `src/components/marketing/curated/CuratedTripGateView.tsx` — pre-submit view
- `src/components/marketing/curated/CuratedTripPersonalisedView.tsx` — post-submit view
- `src/components/marketing/curated/PersonalisedSpecGrid.tsx`
- `src/components/marketing/curated/PersonalisedTeaserBlocks.tsx` — schedule/stay/flights/bookings blocks
- `src/components/marketing/curated/ConversionCTAs.tsx` — Founding + Crew Plus CTAs
- `src/app/(public)/curated/[slug]/founding-checkout/page.tsx` — seat-reservation hold + Stripe init
- `src/app/api/cron/teaser-day-7-nudge/route.ts` — cron endpoint (scheduled hourly via `vercel.ts` `crons` config)
- `src/app/api/cron/finalise-applications/route.ts` — cron endpoint (scheduled every 15 min via `vercel.ts` `crons` config)
- `vercel.ts` — add cron schedules for the two endpoints above (uses `@vercel/config`'s `crons` array)
- `tests/e2e/curatedTeaser.spec.ts` — Playwright smoke

**Modified files:**
- `src/app/(public)/curated/[slug]/page.tsx` — replace single-state render with three-state (cold / personalised / resume)
- `src/components/marketing/CuratedTripView.tsx` — extract data-only helpers, remove public-facing schedule/stays/flights/bookings render
- `src/components/marketing/DepartureBoard.tsx` — collapse two CTAs to one (`Plan your {city} →` → `/curated/{slug}`)
- `src/app/(public)/apply/page.tsx` — detect draft_id, skip captured fields, show 3 ICP-fit questions
- `src/lib/actions/applications.ts` — add `provisional_decision`, `auto_decision_at` logic
- `src/app/(app)/admin/applications/page.tsx` — show provisional decision + draft data inline, approve/reject actions
- `src/app/api/stripe/webhook/route.ts` — on `payment_intent.succeeded`, create first trip from draft data; consume founding reservation
- `src/lib/types.ts` — add `DraftLead`, `TeaserOutput`, `FoundingReservation` types
- `src/lib/marketing/curatedTrips.ts` — no schema changes, but add helpers used by the AI prompt builder (e.g., `getCuratedTripContextForTeaser(slug)`)

## Risks + mitigations

- **AI output quality.** Gemini might produce off-tone or factually wrong teasers. *Mitigation:* tight prompt + Zod schema + cache-by-input means we can manually QA + curate the cached outputs for common input patterns. Also: the teaser is calibrated lean (2 days, 1 stay, vibe-only) — there's not much room for the AI to go wrong.
- **Stripe abandoned checkouts holding founding seats.** *Mitigation:* 15-minute hold timeout. Cron-free release because `expires_at` is the source of truth.
- **Race conditions on `reserve_founding_seat` at the 500-seat boundary.** *Mitigation:* The function uses `count(*)` inside a transaction. Postgres's MVCC + the function's `security definer` should be sufficient. If we observe drift, add `select ... for update` on a `founding_seats` counter row instead.
- **24-hour Crew Plus review window feels long when seats start filling.** *Mitigation:* the `Skip the queue with a founding spot →` upsell on the application-received page captures urgency-driven conversions.
- **Email deliverability.** Transactional emails to fresh leads can land in spam. *Mitigation:* use existing transactional email setup (it's already SPF/DKIM/DMARC configured for invite emails). Monitor bounce rate. The day-7 nudge is the highest-deliverability-risk message; if bounce > 5%, kill the nudge until improved.
