# Tripcrew pricing & business model

This is the canonical repo-side source for paid tiers, who pays, and the subscription lifecycle. Public landing-page copy, account UI, Stripe checkout code, and business docs must stay aligned with this file.

## Current Model

Tripcrew is invite-only for Cohort 01. Visitors either apply for Crew Plus or claim a Founding Crew spot from a curated teaser. There is no public self-serve free-trial offer.

| Plan | Price | Entry path |
|---|---:|---|
| Free | £0 | No card. Invited users can evaluate core planning surfaces. |
| Crew Plus | £9 / month or £79 / year | Application/review, then Stripe Checkout. |
| Founding Crew | £179 / year | Founding fast lane from curated teaser, capped at 500 seats. |

Refund posture: first-time subscriptions are eligible for a 14-day refund. Do not describe Crew Plus as a 7-day free trial.

## Stripe Price IDs

| Tier | Env var | Notes |
|---|---|---|
| Crew Plus monthly | `STRIPE_PRICE_ID` | Required for Crew Plus checkout. No legacy fallback should be used in production. |
| Founding Crew yearly | `STRIPE_FOUNDING_PRICE_ID` | Required for Founding checkout. |

Annual Crew Plus (`£79/year`) is public pricing copy, but the annual checkout path is not wired in the account UI yet. Do not add an annual purchase CTA until a separate Stripe price/env path exists.

## Who Pays: Team-Share Access

One paying admin covers the crew. `hasProAccessForTrip(userId, tripId)` returns paid access when:

1. The current user has paid access themselves, or
2. Any admin on that trip has paid access.

This is deliberate. A trip organiser gets the strongest ROI, but a member can also pay for their own access across trips where no admin has paid.

The implementation lives in [src/lib/plan.ts](../src/lib/plan.ts). Any switch to individual-only or per-seat pricing starts there.

## Tier Gates

| Surface | Free | Crew Plus | Founding Crew |
|---|---|---|---|
| Trip creation, invites, role management | Yes | Yes | Yes |
| Destination proposals, voting, locking | Yes | Yes | Yes |
| Crew chat, photos, bookings, ledger | Yes | Yes | Yes |
| Notifications | Yes | Yes | Yes |
| Lock & Draft narrative plan | Summary/basic output | Full enriched plan | Full enriched plan |
| Structured brief: hero, spec grid, schedule, activities, bookings | No | Yes | Yes |
| Per-candidate draft plans | No | Yes | Yes |
| Pinned moments honoured by AI | Recorded only | Yes | Yes |
| Price refresh | No | Yes, rate-limited | Yes, no standard rate limit |
| Conversational AI planning | No | No | Promised month 1 |
| Cross-trip memory | No | No | Promised months 2-3 |
| Flight monitoring and price-drop alerts | No | No | Promised months 2-3 |
| During-trip AI | No | No | Promised months 3-4 |
| Auto memory book | No | No | Promised months 5-6 |
| Roadmap voting, founder badge, founders wall | No | No | Promised month 1 |

Source of truth for gates is [src/lib/gates.ts](../src/lib/gates.ts) and [src/lib/plan.ts](../src/lib/plan.ts).

## Crew Plus Lifecycle

1. Visitor applies through `/apply` or from a curated teaser.
2. The app creates an `applications` row with provisional decision metadata.
3. Founder/admin review or cron finalisation approves or rejects the application.
4. Approved applicant receives a Crew Plus checkout link.
5. Stripe Checkout creates a subscription using `STRIPE_PRICE_ID`.
6. The Stripe webhook writes subscription fields to `profiles` and stamps `applications.first_paid_at`.
7. If the application came from a curated draft, the webhook provisions the first trip from that draft.

Crew Plus checkout should charge directly. Do not add `trial_period_days` unless the public model changes again.

## Founding Crew Lifecycle

1. Visitor submits a curated teaser.
2. Visitor clicks the founding fast-lane CTA.
3. The app reserves a 15-minute seat hold in `founding_reservations`.
4. Stripe Checkout creates a yearly subscription using `STRIPE_FOUNDING_PRICE_ID`.
5. The webhook provisions the user, creates their first trip from the draft, and stamps `profiles.founding_crew_at`.

Founding seats are capped at 500. The public counter should be based on consumed seats plus active holds when showing checkout scarcity, and on `profiles.founding_crew_at` when describing paid founding members.

## Operational Rules

- Stripe webhook state is authoritative for `profiles.stripe_subscription_status`.
- `trialing` can still appear for legacy rows or Stripe dashboard-created subscriptions; treat it as paid access, but do not market trials.
- `past_due` should keep paid access temporarily while asking the user to update billing.
- `canceled` means access ends at period end, based on Stripe lifecycle.
- `STRIPE_PRICE_ID` and `STRIPE_FOUNDING_PRICE_ID` must be verified in test mode before charging users.

## Open Debt

- Annual Crew Plus checkout path for `£79/year`.
- Durable Founding Crew price-lock mechanics after cancellation/resubscribe.
- Founders wall, founder badge, and roadmap voting surfaces.
- Cleanup of legacy local-trial columns and gate branches once no rows depend on them.
