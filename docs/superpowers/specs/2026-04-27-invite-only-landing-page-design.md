# Invite-only landing page — design

**Date:** 2026-04-27
**Status:** Design approved by founder, ready for implementation plan

## Context

Tripcrew has no public landing page. The root `/` route is auth-gated and redirects unauthed visitors to `/sign-in`. Anyone evaluating the product hits a sign-in form, not a sell. The same auth wall sits in front of `/join/[token]` invite links — friends sent an invite by an existing crew member see the sign-in page, not the trip plan they're being invited to. Both are funnel leaks.

The goal of this work is to ship a public landing page that:

1. Establishes Tripcrew as **invite-only** with a qualified-application gate, building FOMO as the acquisition motion.
2. Delivers a strong sense of the product to unauthenticated visitors so applications are pre-qualified and convert to paid at a high rate.
3. Exposes a **three-tier pricing structure** (Free / Crew Plus / Founding Crew) that anchors the target tier and captures price-insensitive buyers via a status tier.
4. Fixes the `/join/[token]` auth-wall leak with a public read-only preview.

The wedge in the category — group + AI + gated — is unclaimed. AI travel apps (Layla, Mindtrip, Roam Around) are solo and ungated; group planners (Wanderlog, TripIt, SquadTrip) lack AI personality and are open. Tripcrew can credibly own *the invite-only group trip planner that makes trips actually happen.*

## Approach

Ship a single landing page composed of six blocks, plus a public sample-trip page and an updated invite-link experience that share rendering logic.

Research-driven choices:

- **Show product, don't hide it.** Linear, Arc, Notion AI, Raycast all converted to paid at strong rates by showing real product output during their waitlist phase. Mystique-only models (Clubhouse, Robinhood) drove signup volume but cheap conversions. The hero embeds the AI's output as the proof.
- **Static membership stamp, not a queue counter.** A queue position works for time-gated waitlists (Robinhood). For a fit-gated qualified-application model (Gmail 2004, Superhuman) it undermines the framing. Display "INVITE ONLY" as social proof, not as a position you can race up.
- **Email-only on the page, qualifying questions on the next screen.** Superhuman's pattern. Lower friction at the first ask, deeper qualification immediately after.
- **Three-tier pricing anchors the target.** Apple, Stripe, Notion, Linear, Spotify — every B2C SaaS at scale uses three tiers. The middle becomes the obvious choice; the upper tier captures price-insensitive segment via status + price-lock.
- **Voice and aesthetic match the existing brand.** Editorial-brutalist: hard edges, mono labels, accent coral on `#0a0a0a` and `#f5f1e8`. No emojis anywhere on the page. No competitor brand names (Splitwise, WhatsApp, Google Flights all referenced obliquely, never named).

## Block 1 — Hero

Above-the-fold. Full-width.

**Layout:** transformation split (left: WhatsApp-style chat dying out, right: Tripcrew brief rendered) with a wax-seal-style "INVITE ONLY · 2,847 ON LIST" stamp overlaying the top-right at a slight rotation. Apply CTA bar at the bottom of the hero.

**Copy:**

```
Trips that make it out of the group chat.
Pick a city. Pull your crew. Make memories, not just wishes.
```

The headline names the antagonist (group chat) and uses "make it out" for the visceral struggle verb — most group trips don't make it out, that's the failure mode. The subline carries the user's three jobs (city / crew / make memories) and the closing line reframes the outcome as memories, not wishes.

**CTA bar:**

- Primary: email field with `Continue →` button. Microcopy below: `4 QUICK QUESTIONS NEXT · 90 SECONDS`
- Secondary text link: `Have an invite? Enter →`

**Stamp:** "INVITE ONLY · 2,847 ON LIST" — static social proof, not a live queue position. The number can be a real count of submitted applications but is never displayed as the visitor's queue rank.

## Block 2 — How it works strip

Full-width strip directly below the hero. Cream-light background, 3 columns, hard borders.

```
01 · Apply for an invite.
     One email. Three quick questions on the next screen. We approve in batches.

02 · Lock the trip with your crew.
     Pick a city, lock the dates, pull the people in. The AI drafts the plan;
     the crew votes on what stays.

03 · Enjoy your trip.
     Bookings handled. Ledger settled.
     Time to make memories.
```

Step 03's number is rendered in accent coral to signal completion. The third sentence in step 03's body breaks to its own line — the procedural sentences ("Bookings handled. Ledger settled.") sit together, the emotional payoff ("Time to make memories.") gets the deliberate paragraph break that makes it land. Closes the copywriting loop with the hero subline ("Make memories, not just wishes").

A scroll cue below the strip — `↓ SEE A SAMPLE TRIP` — transitions to block 3.

## Block 3 — Sample trip section

Full-width section, dark background. Renders an inline trip tile that previews a real Lisbon trip; clicking through opens `/sample-trip/lisbon`.

**Tile content:**

- Section header: `SEE WHAT THE AI ACTUALLY PRODUCES`
- Subhead: `A real trip. Real budget. Real plan. Six friends. Lisbon. Six days.`
- Inline tile: hero copy (`LISBON`), date range, 4-cell spec grid (`PER HEAD £820`, `CREW 6`, `FROM LHR`, `VIBES FOODIE · WINE`), 3 of 6 schedule rows (Day 1 / Day 2 / Day 3 with named places), polaroid stack on the right
- Microcopy under the CTA: `SHAREABLE · GROUP-CHAT-READY` — surfaces the URL-as-asset motion (visitors realise they can paste this link into their crew's chat)
- CTA: `EXPLORE THE FULL TRIP →` linking to `/sample-trip/lisbon`

`/sample-trip/lisbon` is a separate page using the actual production trip-overview components (same hero, spec grid, schedule, ledger, etc.), seeded with a fixed Lisbon trip in the database. This is the strongest organic acquisition asset — visitors can copy-paste the URL into their own group chats. Watermarked top-right with `SAMPLE TRIP · LISBON` ribbon.

**v2 deferred (in memory):** personalized teaser — visitor types their destination + 2 vibes, AI generates a one-shot mini-plan inline. Pull this lever only if v1's read-only Lisbon underperforms on application rate (target: ~5%). See `~/.claude/projects/-Users-nigel-Claude-tripcrew/memory/project_landing_page_v2_personalized_teaser.md`.

## Block 4 — Application form (two-stage)

**Stage 1 — embedded in the hero CTA bar.**

- Single email field with `Continue →` button. Nothing else on the page.
- Microcopy below the button: `4 QUICK QUESTIONS NEXT · 90 SECONDS` — sets expectation so visitors don't bounce when stage 2 appears.

**Stage 2 — `/apply` route, full page.**

Four multiple-choice questions. No text fields. Total target time: ~60–90 seconds. Each click filters or qualifies; no vanity questions.

```
01 · Trips per year
     0  ·  1  ·  2-3  ·  4+

02 · When your crew talks about a trip, you're...
     The one who organises it
     The one who shows up
     Depends on the trip

03 · What kills most of your trips?
     Dates never align
     Nobody books anything
     Money gets weird
     Plan never gets made
     Trips happen but feel chaotic

04 · When it comes to trip budgets, you...
     Treat it like monopoly money
     Splurge on what matters
     Make every pound count
     It depends on the trip
```

**What each question does:**

- Q1 — frequency filter. Separates active trip-planners from tire-kickers.
- Q2 — ICP filter. Flags admins (the ICP, the buyer). Members get approved at lower priority.
- Q3 — pain capture. Feeds the personalised confirmation copy and the welcome email's opening line. Doesn't gate.
- Q4 — willingness-to-pay proxy. Reads as a personality question; works as a buyer filter. "Treat it like monopoly money" answers self-ID the highest-WTP segment in one click. Also feeds the user's default budget tier in their first in-app trip (matches `AiBudgetTier`).

**Approval algorithm (rough):** score = `Q1 weight × Q2 weight × Q4 weight`. Q3 doesn't gate. Approve in batches; never disclose the score to the user. Visitor sees "approved in batches" not "you scored 8/10."

**Stage 3 — confirmation page.** Cream-light, centered.

```
APPLICATION RECEIVED
You said dates never align.
That's what we're best at.
We approve in batches. Expect an invite within 14 days.
Members can also fast-track you — if a friend's already on Tripcrew,
ask them to send you one of their slots.
2,847 ON THE LIST · ~30 INVITED PER WEEK
```

The pain articulated in Q3 is mirrored back in the headline. The "members can fast-track you" line surfaces the D-mechanic invite path — if the visitor has a friend already in, they'll ask. That's organic activation.

## Block 5 — Pricing reveal (three-tier)

Full-width section. Cream-light background. Three columns, hard borders, varying weights.

**Tiers (from left to right):**

```
FREE                     CREW PLUS                  FOUNDING CREW
£0                       £9 / month                  £179 / year
forever                  £79/yr · save 27%           price locked for life
                         ← MOST CREWS PICK           47 / 500 LEFT

Try it.                  AI plans your trip.         Your AI travel concierge.
See your invited trips.  One admin pays;             Dream trips, zero effort.
Get the AI summary       the whole crew gets in.     Founding members shape
draft.                                               the product.
```

**Free tier bullets:**
- `→ Summary AI overview`
- `→ View crew trips you're invited to`
- `→ Crew chat + photos`

**Crew Plus tier bullets:**
- `→ AI plans the whole trip — the trip actually happens`
- `→ One admin pays — Pro covers the whole crew`
- `→ Bookings in one place — no more "who has the link?"`
- `→ Money sorted in-trip — one less app to juggle`
- `→ A chat just for this trip — not another group to mute`
- `→ Real flight prices, refreshed on demand`

**Founding Crew tier bullets:**
- `→ Everything in Crew Plus`
- `→ Plan by talking — conversational AI, no more forms`
- `→ Each new trip starts smarter — AI learns your crew`
- `→ Watching for you — flights, events, opportunities`
- `→ During-trip AI — ask anywhere, anytime`
- `→ A real memory book — auto-built when the trip ends`
- `→ Shape the roadmap — your votes pick what ships next`
- `→ Founder badge · founders wall · grandfathered for life`

**Visual hierarchy:**
- Free reads as cream-light — the on-ramp.
- Crew Plus reads as dark grey with an accent-coral "MOST CREWS PICK THIS" ribbon — the obvious-choice middle.
- Founding Crew reads as full black with an accent-coral left border + "47 / 500 LEFT" counter top-right — the inner circle.

**The transformation each tier sells:**
- Free: *Let me see what this is.*
- Crew Plus: *This trip is going to actually happen.*
- Founding Crew: *I have a personal travel team. I just say where I want to go.*

**Founding Crew is a real concierge tier, not a status play.** The features ladder over months 1–6 (see `roadmap.md`):

1. **Month 1 (launch):** conversational AI chat, founder badge, founders wall, lifetime price-lock, roadmap voting feature.
2. **Months 2–3:** cross-trip memory, live flight monitoring + price-drop alerts.
3. **Months 3–4:** during-trip AI (location-aware queries on mobile), event/opportunity alerts.
4. **Months 5–6:** auto memory book (PDF first; printed-and-mailed as v2 stretch).

Founding members get every feature 30 days before Crew Plus. After 500 sell out, the tier continues as **"Crew Concierge"** at £29/mo or £249/yr for new buyers; Founding Crew members are price-locked at £179/yr forever.

The £179/yr price is intentionally underpriced for the value. It's the loss leader for evangelism — Founding members are the public face of the product, the people who post screenshots and write referrals. Their lifetime price-lock becomes a real moat over time.

## Block 6 — Invite-link landing (`/join/[token]`)

Replaces the current auth-walled `/join/[token]` page. Public read-only render of the inviter's trip with a join CTA.

**Sequence on the page:**

1. **Inviter strip** (cream background, top): inviter avatar + `<Name> invited you to a trip.` + microcopy `SKIP THE QUEUE · INVITE-ONLY ACCESS GRANTED`. Right side: `CREW INVITE` pill.
2. **Trip header**: city name big, date range + duration + occasion as mono-cap subhead.
3. **Spec grid**: 4 cells (per head, crew, from, vibe) — all visible.
4. **Schedule**: first 3 days fully detailed with named places. Last 3 days collapsed into a single dashed-border row with mono-cap text: `3 MORE DAYS · UNLOCK WHEN YOU JOIN`. The dashed border carries the locked signal — no emoji, no padlock icon.
5. **Crew counter as the final push** (just above the CTA): mono-cap `5 LOCKED IN · YOU'RE THE 6TH` + horizontal row of 5 crew avatars (initials, first names below) + dashed-border placeholder for the invitee with `YOU'D MAKE 6` label.
6. **Primary CTA**: `I'M IN →` button + microcopy `10 SEC TO JOIN · PRO IS COVERED BY <Inviter Name>`.
7. **Footer line**: `Not for you? Just close the tab. <Inviter> won't see who didn't accept.`

**Why the crew counter is at the bottom, not the top:** information first, social pressure last. The friend evaluates the trip on its merits, *then* sees the crew already locked in, *then* decides. The narrative arc is: hook (invite from friend) → reveal (the trip) → push (crew is in, slot is yours) → action (CTA). Putting social proof at the top would feel like pressure before substance.

**Privacy scope.** Public on the invite-link page: hero, spec grid, schedule (with last 3 days teased), crew avatars, first names. Private (gated behind sign-up): bookings, ledger, chat — no expense or financial data leaks pre-auth.

**Shared rendering with `/sample-trip/lisbon`.** Both surfaces use the same trip-preview component. The sample-trip page is a fixed Lisbon trip with no inviter strip / no crew counter / no CTA-to-join. The invite-link page is token-gated, hydrated with the real inviter + trip + crew. Build once, ship two surfaces.

## Application data model + analytics

A new `applications` table captures Q1–Q4 answers and lifecycle state. Joins against `profiles` and Stripe webhooks close the loop from application → activation → paid conversion, so we can validate which form answers actually predict revenue.

```sql
create table applications (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz default now(),

  trips_per_year text check (trips_per_year in ('0','1','2-3','4+')),
  role text check (role in ('organiser','attendee','depends')),
  pain text check (pain in ('dates','booking','money','plan','chaos')),
  budget_attitude text check (budget_attitude in ('monopoly','splurge','count','depends')),

  approved_at timestamptz,
  approved_by uuid references profiles(id),
  invite_token text,
  invite_sent_at timestamptz,
  user_id uuid references profiles(id),
  activated_at timestamptz,
  first_trip_at timestamptz,
  first_lock_at timestamptz,
  first_paid_at timestamptz,

  utm_source text,
  utm_campaign text,
  referrer text
);

create index on applications(user_id);
create index on applications(approved_at) where user_id is null;
```

The `user_id` foreign key bridges application records to the rest of the system. Once a user accepts an invite and creates their auth profile, `applications.user_id` is set. From that point, every application's downstream outcome is one join away from `profiles.stripe_subscription_status` and `trips.enriched_draft_tier`.

A Stripe webhook on `customer.subscription.created` sets `applications.first_paid_at` on the matching application row, closing the loop without manual joins.

A `/admin/applications` dashboard page surfaces the four queries that matter:

1. **Conversion-by-segment**: paid rate per `budget_attitude`, per `role`, per `pain`. Validates whether each form answer is a real predictor or a vanity question.
2. **Time-to-paid by segment**: median days from approval → upgrade.
3. **Approval algorithm validation**: predicted segment (from Q1 × Q2 × Q4) vs. actual paid conversion rate.
4. **Source attribution**: paid rate per `utm_source` / `referrer`.

PostHog event tracking is deferred to v2 — SQL aggregates are enough for the launch decisions.

## Files

**New:**

- `src/app/(public)/page.tsx` — landing page composing all six blocks
- `src/app/(public)/layout.tsx` — public route layout (no auth middleware)
- `src/app/(public)/apply/page.tsx` — stage 2 application form
- `src/app/(public)/apply/confirmation/page.tsx` — stage 3 personalised confirmation
- `src/app/(public)/sample-trip/[slug]/page.tsx` — public read-only trip preview (Lisbon as the seed)
- `src/components/marketing/Hero.tsx` — transformation split + membership stamp + email-only CTA
- `src/components/marketing/HowItWorks.tsx` — 3-step strip
- `src/components/marketing/SampleTripTile.tsx` — inline trip preview that links to the full sample-trip page
- `src/components/marketing/ApplicationForm.tsx` — multi-question form (used on `/apply`)
- `src/components/marketing/PricingReveal.tsx` — three-tier pricing block with live counter
- `src/components/trips/TripPreview.tsx` — shared component used by `/sample-trip/[slug]` and `/join/[token]` (rendering logic for the public read-only render with redacted last days + crew counter)
- `src/lib/actions/applications.ts` — server action: create application from email + Q1–Q4 answers
- `supabase/migrations/<ts>_applications_table.sql` — `applications` table + indexes
- `src/app/api/stripe/webhook/route.ts` (extend) — set `applications.first_paid_at` on `customer.subscription.created`
- `src/app/(app)/admin/applications/page.tsx` — admin analytics dashboard (founder-only)
- Public marketing layout assets (font preloads, OG images, etc.)

**Edited:**

- `src/middleware.ts` — exempt `(public)` route group from the auth redirect; only authed `(app)` routes redirect to sign-in
- `src/app/(app)/page.tsx` → moved to `src/app/(app)/dashboard/page.tsx` — the existing trip-dashboard is now `/dashboard`. The new public landing takes `/`.
- `src/app/(public)/page.tsx` (new) — root `/` for unauthed visitors. Middleware redirects authed users hitting `/` to `/dashboard` so paying users never re-see the marketing page.
- `src/app/join/[token]/page.tsx` — render the public preview block + new join CTA; current auth flow becomes the post-CTA action
- `supabase/migrations/<ts>_founding_crew_flag.sql` — add `profiles.founding_crew_at timestamptz` (nullable). Stripe webhook sets this on the first `customer.subscription.created` for the founding-crew price ID. The "47 / 500 LEFT" counter is `500 - count(*) where founding_crew_at is not null`.
- `roadmap.md` — kept in sync as Founding Crew features ship

## Open product decisions (deferred)

- **Polaroid memory stack** — currently shipped on the trip overview hero. Founder review: doesn't match the rest of the UI; lower transformational signal than bookings/ledger/feed. Removed from Crew Plus marketing copy on this page. Open question: keep as-is in app, rework visually, or replace with the auto memory book promised to Founding Crew. Tracked in `roadmap.md` under "Open product decisions."

## Out of scope for v1

- **Personalised teaser on the landing page** — visitor types destination + 2 vibes, AI generates a mini-plan inline. Defer until we have data on read-only Lisbon's conversion rate. See memory file `project_landing_page_v2_personalized_teaser.md`.
- **PostHog event tracking** — SQL aggregates are enough for launch decisions; PostHog can be layered on once event-level funnel analysis is needed.
- **Member-invite quotas wired into the app** — D-mechanic mentions "members can also invite you" on the confirmation page, but the slot allocation system itself ships in a follow-on. v1 invites work via the existing `trip_invites` table; founder-level invite slots are a v2 lever.
- **A/B testing infrastructure** — manual A/B tests via cohort flagging are fine for v1.
- **Welcome email sequence and approval batch automation** — covered as separate work in `roadmap.md` under "Onboarding & lifecycle."

## Verification

1. **Anonymous visitor flow.** Visit `/` while signed out. Lands on the new landing page (not sign-in). Sees the hero, scrolls through how-it-works, sample trip, pricing, footer. Clicks `Apply for invite`. Email field accepts an address; clicking `Continue →` lands on `/apply` with the four questions. Submitting routes to a confirmation page that mirrors the Q3 answer back. Application row appears in the database.
2. **Authed visitor flow.** Visit `/` while signed in. Lands on the existing trip dashboard, not the landing page. Existing user paths unchanged.
3. **Sample trip page.** Visit `/sample-trip/lisbon` while signed out. Sees a fully rendered read-only Lisbon trip with the `SAMPLE TRIP · LISBON` ribbon. URL is shareable; pasting it into a fresh browser context renders cleanly without auth.
4. **Invite-link page.** Visit `/join/<valid-token>` while signed out. Sees the public preview with inviter strip, trip details with last-3-days locked, crew counter above the CTA, `I'M IN →` button. Clicking the button initiates the auth flow; after sign-in the user lands inside the trip.
5. **Pricing tier render.** Pricing block renders all three tiers. Founding Crew counter reads from `select count(*) from profiles where founding_crew_at is not null` (or equivalent). Decrements as Stripe webhook receives subscription create events for the founding-crew price ID.
6. **Application analytics.** `/admin/applications` (founder-only) renders the four queries. After 100+ applications and at least 10 paid conversions, the conversion-by-segment table shows differential rates by `budget_attitude` — validates Q4 as a real WTP filter.
7. **No emojis on the page.** Grep the rendered HTML for any emoji codepoints — should return zero.
8. **No competitor brand names.** Grep the rendered HTML for `Splitwise`, `WhatsApp`, `Google Flights` — should return zero.
9. **Roadmap sync.** Each Founding Crew feature shipped flips its `roadmap.md` row from 📋 to ✅ with commit hash + date.
