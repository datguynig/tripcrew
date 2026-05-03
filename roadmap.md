# Yenkoh Roadmap

Working document. Gitignored. Tracks what's shipped vs. what we've promised — especially the Pioneer tier commitments. Update as features land.

**Last updated:** 2026-05-03

---

## Honesty audit — public copy vs. shipped (2026-04-30)

Cross-checked every feature claim on the public marketing surfaces against `src/lib/gates.ts`, the `(public)` route group, and the AI/draft pipeline. **No feature gate currently lies** — paid-only surfaces are correctly blocked at runtime. The risk is in marketing copy that promises Pioneer benefits we haven't built yet, plus two pricing/copy mismatches called out below.

### Member — 6 of 6 public claims shipped ✅

Source: [PricingReveal.tsx](src/components/marketing/PricingReveal.tsx) Member tier + [FeatureShowcase.tsx](src/components/marketing/FeatureShowcase.tsx) tiles 1–5 + [SubscriptionPanel.tsx](src/components/account/SubscriptionPanel.tsx).

| Public claim | Implementation | Status |
|---|---|---|
| "Drafts a plan from your origin, budget, dates, vibe" | `lockAndStartDraft` → `generateLockAndDraft` writes `enriched_draft` + structured brief | ✅ |
| "Use it on every trip. No per-trip cost" | `hasProAccessForTrip` covers all admin trips; `canGenerateDraft` allows 10 regens/trip | ✅ |
| "Bookings in one place" | `bookings` table + checklist UI | ✅ |
| "Money sorted in-trip" | `expenses` table + per-person balance computation | ✅ |
| "A chat just for this trip" | `posts` + realtime feed at `/feed` | ✅ |
| "Real flight prices, refreshed on demand" | SerpApi Google Flights, gated by `canRefreshPrices` | ✅ |

### Pioneer — 1 of 7 public claims shipped 🔨

Source: [PricingReveal.tsx](src/components/marketing/PricingReveal.tsx) Pioneer tier + [FAQ.tsx](src/components/marketing/FAQ.tsx) Q5.

| Public claim | What's required | Status | Tracked below in |
|---|---|---|---|
| "Plan by talking. Conversational AI" | New `/trips/[slug]/concierge` route + multi-turn chat | 📋 | M1 |
| "Each new trip starts smarter. AI learns your crew" | `crew_profile` table + prompt augmentation | 📋 | M2–M3 |
| "Watching for you: flights, events, opportunities" | Daily SerpApi cron + event matching | 📋 | M2–M3 |
| "During-trip AI. Ask anywhere, anytime" | Mobile chat + location-aware context | 📋 | M3–M4 |
| "A real memory book, auto-built when the trip ends" | Post-trip PDF generation pipeline | 📋 | M5 |
| "Shape the roadmap. Your votes pick what ships next" | Public roadmap surface + voting model | 📋 | M1–M2 |
| "Founder badge · founders wall" | `FounderBadge` renders in feed/account + public `/founders` route | ✅ | M0 |

`founding_crew_at` now drives visible founder status in-app and on the public founders wall. The remaining credibility risk is the M1–M6 concierge promise gap: conversational AI, roadmap voting, cross-trip memory, monitoring, during-trip AI, and memory-book fulfilment are still promised but unbuilt.

> Note: `is_founder` on `profiles` is the **platform-admin** flag (gates `/admin/applications/*`), not the Pioneer tier. Don't conflate them.

### Copy ↔ implementation mismatches to fix

| Where | What it says | What's true | Fix |
|---|---|---|---|
| ~~[HowItWorks.tsx:23](src/components/marketing/HowItWorks.tsx) step 03~~ | ~~"Photos in the memory book."~~ Reworded to "Photos saved with the trip." on 2026-04-30. | ✅ Fixed | — |
| ~~[PricingReveal.tsx:38](src/components/marketing/PricingReveal.tsx) Member billing~~ | ~~"£79 / year · save 27%" implies annual is purchasable.~~ Annual wired into the post-approval checkout email on 2026-05-01. Set `STRIPE_PRICE_ID_ANNUAL` in env to enable. | ✅ Fixed | — |

Neither item misleads at the gate boundary — both are landing-page copy issues. Treat them as P1 before the next public traffic push.

---

## Status legend

- ✅ **Shipped** — live in production
- 🔨 **Building** — actively in progress this session/week
- 📋 **Promised** — committed to via Pioneer or landing-page copy; build deadline matters
- 🔮 **Future** — known direction, no commitment yet

---

## Member (the working tier — £9/mo · £79/yr)

**Promise:** *"AI plans your trip. The trip happens."*

| Feature | Status | Notes |
|---|---|---|
| Full enriched AI plan (brief + plan unified) | ✅ | Shipped 2026-04 (commit `c45661a`) |
| Vibe-driven Places fetch + structured prompt | ✅ | Shipped 2026-04 (commit `8f688f5`) — 22-tag taxonomy, vibe map drives Places + prompt |
| Crew share (admin's Pro covers crew) | ✅ | `hasProAccessForTrip` in plan.ts; trialing status fixed in commit `e743e80` |
| Live flight prices via SerpApi Google Flights | ✅ | Shipped 2026-04 (commit `a6158fe`) |
| 10 regens per trip (gating) | ✅ | `canGenerateDraft` gate |
| Bookings checklist | ✅ | Per-trip bookings table |
| Ledger + per-person balances | ✅ | v1 expenses + balance compute. Enhanced 2026-05-02 by Ledger v2 Phase 1 (PR #9): `expense_participants` table, FX columns, soft-delete, edit dialog, custom splits. Enhanced 2026-05-03 by Phase 2 (PR #10): payback schedules, `payment_obligations` + `payments` tables with state machine, daily cron reminder, ScheduleView + ReissuedPanel surfaces |
| Realtime crew chat (feed) | ✅ | `/feed` route, posts + likes + replies |
| Polaroid memory stack | ✅ | Shipped — auto-composed slot 0–4 + admin overrides |
| Per-trip ambient tint | ✅ | Hero photo dominant-colour extraction |
| Member Stripe checkout | ✅ | `createCheckoutSession` action; webhook validated |

---

## Pioneer (the concierge tier — £179/yr lifetime · capped 500)

**Promise:** *"Your AI travel concierge. Dream trips, zero effort."*

After 500 sell out, this tier continues as **"Crew Concierge"** at £29/mo for new buyers. Founding members are price-locked at £179/yr forever.

### Required at launch (Month 0)

| Feature | Status | Notes |
|---|---|---|
| Founder badge in app | ✅ | Shipped 2026-04-30 in founding-crew-m0 (`9578d77`, `4fbdaaa`, `ff237a2`) |
| Founders wall (page listing all 500) | ✅ | Shipped 2026-04-30 in founding-crew-m0 (`49be2d0`); public route `/founders`, newest-first display |
| Lifetime price-lock + grandfathered pricing | ✅ | Shipped 2026-04-30 in founding-crew-m0 (`951b5e1`, `db4788d`); `profiles.pricing_grandfathered_at` flag |
| `47/500 LEFT` live counter on landing page | 📋 | Counts active subscriptions where tier=founding_crew |
| Stripe webhook updates Pioneer count | 📋 | Auto-decrement remaining slots |

### Promised in months 1–6 (this is the £179/yr value gap)

| Feature | Target month | Status | Notes |
|---|---|---|---|
| **Conversational AI** — plan + refine via chat | M1 | 📋 | New `/trips/[slug]/concierge` route; chat UI on top of existing AI; multi-turn refinement |
| **Roadmap voting** | M1–M2 | 📋 | Founders see + vote on a public roadmap; replaces Slack as direct-influence benefit |
| **Cross-trip memory** | M2–M3 | 📋 | AI learns crew preferences across trips; new `crew_profile` table; prompt gains "this crew typically prefers X" context |
| **Live monitoring — price drops** | M2–M3 | 📋 | Daily SerpApi check on locked trips; notification if low-end drops >10% |
| **Live monitoring — event alerts** | M3 | 📋 | Match major events (F1, Coachella, restaurant openings) to planned dates; surface as "you might want to know" cards |
| **During-trip AI** — location-aware queries | M3–M4 | 📋 | Mobile-first chat; uses trip itinerary + current location for "what's good for lunch near us?" |
| **Auto memory book — PDF** | M5 | 📋 | Generated post-trip from polaroids + ledger + key moments; emailed to crew |
| **Auto memory book — printed + mailed** | M6 (stretch) | 🔮 | Lulu/Print API integration; opt-in shipping |

---

## Landing page (this brainstorming session's deliverable)

The whole reason for this roadmap.

| Block | Status | Notes |
|---|---|---|
| Public marketing route group + `/` redirect change | 📋 | Currently auth-walled; needs public route group |
| Hero — "Trips that make it out of the group chat" + membership stamp | 📋 | Headline + subline + CTA bar locked in brainstorm |
| How it works strip (3 steps) | 📋 | Apply / Lock the trip / Enjoy your trip |
| Sample trip tile + `/sample-trip/lisbon` page | 📋 | Read-only Lisbon plan, shareable URL |
| Application form (two-stage, 4 questions) | 📋 | Email-only on landing; Q1–Q4 on `/apply`; personalised confirmation |
| Three-tier pricing reveal | 📋 | Free / Member / Pioneer; live counter |
| Invite-link landing (`/join/[token]` public render) | 📋 | Block 6 — not yet designed; fixes the auth-walled invite leak |
| Application data model (`applications` table) | 📋 | Captures Q1–Q4 + lifecycle state |
| `/admin/applications` analytics dashboard | 📋 | Funnel + segment-level paid conversion queries |
| `/admin/applications/queue` triage view | 📋 | Pending list with score column, bulk-approve, real-time updates |
| `/admin/applications/[id]` detail + actions | 📋 | Approve / hold / reject; welcome email on approve |
| `is_founder` flag on profiles | 📋 | Gates all `/admin/applications/*` routes |
| Stripe webhook → application linkage | 📋 | Sets `applications.first_paid_at` on subscription create |
| Welcome email + magic link template | 📋 | Mirrors Q3 pain in opening line |
| HowItWorks step 03 memory-book copy fix | ✅ | Reworded to "Photos saved with the trip." on 2026-04-30. |
| Member annual £79/yr — wire it or soften copy | ✅ | Wired 2026-05-01. Post-approval email now includes both annual and monthly CTAs when `STRIPE_PRICE_ID_ANNUAL` is set; route resolves the right price by `?interval=annual`. |

---

## Onboarding & lifecycle

| Feature | Status | Notes |
|---|---|---|
| Welcome email post-application | ✅ | Mirrors Q3 pain ("you said dates never align...") — landed 2026-04-27 |
| Approval batch notification email | 📋 | Magic-link sign-in to skip auth friction |
| Magic-link `?invite=` consumer + applications.user_id linkage | 📋 | Sign-in flow currently ignores the query param. After applicant signs in, look up applications by invite_token, set user_id + activated_at. Until shipped, the link is manual SQL. |
| First-trip activation flow | 📋 | Approved user lands into something useful, not empty dashboard |
| PMF survey at month 1 of paid | 📋 | "How would you feel if you couldn't use Yenkoh?" — Vohra's gold-standard metric |

---

## Validation & analytics

| Item | Status | Notes |
|---|---|---|
| `applications` table + lifecycle state | 📋 | Captures Q1–Q4 answers + funnel stages |
| Stripe webhook closes the loop | 📋 | `applications.first_paid_at` updated on `customer.subscription.created` |
| `/admin/applications` dashboard | 📋 | Conversion-by-segment SQL queries surfaced as charts |
| PostHog event funnel | 🔮 | Deferred; SQL aggregates enough for v1 |
| Q4 budget-attitude → paid conversion test | 📋 | Validates whether Q4 is a real WTP filter or vanity question |

---

## Open product decisions

These are shipped or in-flight things that need a deliberate keep/rework/kill call.

| Item | Issue | Open question |
|---|---|---|
| **Polaroid memory stack** (currently shipped on trip overview hero) | Doesn't match the rest of the UI per founder review. Lower transformational signal than bookings/ledger/feed. **Removed from Member marketing benefits as of 2026-04-27.** | Keep as-is in app, rework visually, or replace with a different memory artifact (e.g. the auto-generated memory book promised to Pioneer)? |

---

## Deferred / known v2+

These are real things we know we want but aren't promising publicly yet.

| Item | Why deferred | Source |
|---|---|---|
| **Ledger v2 Phase 3 — post-trip settle-up** | Spec + plan written 2026-05-02. ~6 tasks (pair-wise nets, ad-hoc obligations, `expense_settled` notification fanout). Phases 1 + 2 shipped 2026-05-03 in PRs #9 + #10. | [docs/superpowers/plans/2026-05-02-ledger-v2.md](docs/superpowers/plans/2026-05-02-ledger-v2.md) |
| **Rotate `CRON_SECRET` in Vercel Production** | Currently set to placeholder `dev-only-cron-secret-not-for-prod`. 30-second fix: `openssl rand -hex 32`, paste into Vercel env vars, redeploy. All 4 daily crons share the secret. | Flagged 2026-05-03 |
| Personalised teaser on landing page | Ship read-only Lisbon first, measure, only build if v1 underperforms | [memory: project_landing_page_v2_personalized_teaser](~/.claude/projects/-Users-nigel-Claude-tripcrew/memory/project_landing_page_v2_personalized_teaser.md) |
| Bookings agent (actual booking, not just suggestions) | Big undertaking, MCP/API integrations | Pioneer v2 |
| Multi-trip dashboard (manage 5+ active trips) | Useful for power users, not core promise | Pioneer v2 |
| Realtime catch-up race fix on feed/shortlist/bell | Known issue; only Destinations.tsx is patched | [memory: project_realtime_subscribe_race](~/.claude/projects/-Users-nigel-Claude-tripcrew/memory/project_realtime_subscribe_race.md) |
| Mobile native app | Web-first for now; mobile is huge investment | — |
| Skyscanner with IATA + affiliate revenue | We use Google Flights now; revisit if affiliate $ justifies it | — |

---

## How to use this doc

- **When you ship a Pioneer feature:** flip 📋 → ✅, add the commit hash + date.
- **When you commit to a new public promise:** add a 📋 row with target month.
- **When you defer something you previously promised:** move it to "Deferred" and note why — public promises that slip damage the brand more than missed silent goals.
- **The Pioneer section is the audit trail of what you owe paying customers.** Treat it more strictly than the others.
- **Update "Last updated" at the top** when you make material changes.
