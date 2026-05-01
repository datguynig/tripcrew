# Yenkoh Business Operating Manual

Last updated: 2026-04-28

## Business Frame

Yenkoh helps groups move from "we should go somewhere" to a locked, shared trip plan. The app combines group decision-making, shared trip operations, and AI planning. The core buyer is the organiser who carries the invisible labour of dates, budgets, bookings, itinerary shape, and group follow-through.

The product promise is not "AI writes an itinerary." The stronger promise is: trips make it out of the group chat, the crew has one shared source of truth, and the admin does not have to become a part-time travel agent.

## Product Loop

1. A user creates a trip.
2. The crew joins through invite links.
3. Members propose destinations and vote yes/maybe/no.
4. An admin locks the winning destination.
5. The admin can run Lock & Draft, which saves trip preferences and generates the overview, plan, shortlist, bookings, and supporting content.
6. The crew collaborates through bookings, ledger, feed, notifications, and activity voting.

The loop is strongest when the first locked trip is created quickly. Any acquisition or onboarding flow should protect that moment.

## Customer Segments

Primary customer: the trip organiser.

- Owns the work of aligning people, budget, dates, and plan quality.
- Gets the highest value from team-share pricing because one admin subscription unlocks paid features for the whole crew.
- Cares about fewer loose threads more than more itinerary ideas.

Secondary customer: the power member.

- Joins multiple trips and may subscribe personally when admins do not.
- Values continuity, memory, and seeing all travel plans in one place.
- Is less likely to justify paying on behalf of a group.

Founder-tier customer: the status and concierge buyer.

- Wants early access, direct influence, and higher-service AI planning.
- Buys confidence and identity as much as functionality.
- Expects the roadmap promise to be explicit and honoured.

See the Notion personas document for narrative detail and external validation.

## Commercial Model

The canonical pricing source is [docs/pricing.md](../pricing.md).

Current tiers:

- Free: trip creation, invites, voting, chat, bookings, ledger, notifications, and basic evaluation.
- Member: full AI planning surfaces, paid gating for planning depth, and team-share access.
- Pioneer: annual founder tier with lifetime price-lock and a six-month concierge feature ladder.

The load-bearing mechanic is team-share access. `hasProAccessForTrip` gives paid access when the user is paid or any trip admin is paid. This is the strongest organiser pitch and should remain visible in pricing copy.

## Funnel

Public funnel:

1. Landing page establishes invite-only positioning.
2. Email capture sends the visitor to `/apply`.
3. Application answers qualify trip frequency, role, pain, and budget attitude.
4. Founder/admin queue approves, holds, or rejects applications.
5. Approved users convert through Stripe Checkout.
6. Stripe webhook stamps subscription state and closes the application conversion loop.

Curated teaser funnel:

1. Visitor lands on `/curated/[slug]`.
2. Full plan detail is gated behind a lightweight personalized teaser form.
3. The app stores a draft lead and renders calibrated proof without giving away all operational specifics.
4. Visitor chooses either Founding fast lane or Member review.
5. Paid success should eventually create the first trip from captured draft data.

## Operating Cadence

Daily during launch:

- Review new applications, approvals, rejections, and conversion rate.
- Check Stripe events and webhook failures.
- Check AI usage for unusual spend or failure spikes.
- Review support notes and founder/user feedback.

Weekly:

- Reconcile public promises against `roadmap.md` and [public-promise-ledger.md](./public-promise-ledger.md).
- Review activation: applications, approved users, paid users, first trip created, first destination locked, first AI draft generated.
- Update copy or onboarding where users stall.

Before any launch milestone:

- Re-run the checklist in [launch-command-center.md](./launch-command-center.md).
- Confirm pricing, Stripe price IDs, and Pioneer count behaviour.
- Confirm trust-sensitive copy matches the app's actual security posture.

## Non-Negotiables

- Do not advertise end-to-end encrypted chat. Crew chat is RLS-protected app data, not an E2E messenger.
- Do not charge Pioneer unless launch promises are either shipped or clearly framed as timed roadmap benefits.
- Do not change pricing copy without checking Stripe env vars, account UI, landing pricing UI, and [docs/pricing.md](../pricing.md).
- Do not treat AI cost as free. Gemini and Google Places usage must remain visible through `ai_usage`.
- Do not let Notion become the only source of truth for promises that code must enforce.
