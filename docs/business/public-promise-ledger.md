# Public Promise Ledger

Last updated: 2026-04-28

This doc tracks what Tripcrew says publicly, where it is implemented, and what must be kept honest before launch. It complements `roadmap.md`, which remains the stricter working accountability document.

## Status Key

- Shipped: implemented in the app and safe to market.
- Partial: some supporting code exists, but copy needs caveats.
- Promised: committed in pricing/landing docs, but not fully shipped.
- Do not market yet: useful idea, but too early or not backed by code.

## Core Product Promises

| Promise | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Create a shared group trip with roles and invite links | Shipped | `trips`, `trip_members`, `trip_invites`, `/trips/new`, `/join/[token]` | Keep invite-link public preview honest if changing middleware. |
| Propose destinations and vote as a crew | Shipped | `/trips/[slug]/destinations`, `destination_candidates`, `destination_votes` | Core free-tier value. |
| Admin locks the winning destination | Shipped | Destination lock actions and trip `status` lifecycle | Locking is the transition into overview. |
| AI creates the trip plan after lock | Shipped/partial by tier | `generateLockAndDraft`, Gemini, Places, `enriched_draft` | Free tier receives limited/basic output; paid receives full structured brief. |
| Shared bookings checklist | Shipped | `bookings`, `/bookings` | Market as coordination, not agentic booking. |
| Shared expense ledger | Shipped | `expenses`, `/ledger` | Market as settlement support, not banking. |
| Crew chat for the trip | Shipped | `posts`, `post_likes`, `/feed` | Must include non-E2E security posture where relevant. |
| Realtime updates | Shipped | Supabase Realtime hooks | Avoid overpromising perfect conflict resolution. |
| Notifications bell | Shipped | `notifications`, `trip_notification_prefs` | In-app only; push notifications are not built. |

## Pricing And Tier Promises

| Promise | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Free tier supports core group planning | Shipped | Free surfaces are not paywalled | Do not imply AI depth is free. |
| Crew Plus is GBP 9/mo or GBP 79/yr | Partial | `docs/pricing.md`, landing pricing block | Monthly checkout exists behind approval. Annual checkout path still needs implementation before an annual CTA. |
| One paying admin covers the crew | Shipped | `hasProAccessForTrip` | This is the strongest pricing promise. |
| Crew Plus gets full Lock & Draft | Shipped | `canGenerateDraft`, `lockAndDraft` | Verify generation caps before broad launch. |
| Founding Crew is GBP 179/yr capped at 500 | Partial | `profiles.founding_crew_at`, founding count helper | Stripe price ID and live counter behaviour must be verified. |
| Founding Crew price-lock for life | Promised | `docs/pricing.md`, `roadmap.md` | Implementation needs a durable price-lock/grandfathering story beyond copy. |

## Founding Crew Promise Ladder

| Promise | Target | Status | Notes |
| --- | --- | --- | --- |
| Founder badge | Launch/month 1 | Promised | Not safe to market as shipped until visible in product. |
| Founders wall | Launch/month 1 | Promised | Public route not confirmed shipped. |
| Roadmap voting | Month 1 | Promised | Define whether this is Notion, in-app, or a simple voting surface. |
| Conversational AI planning | Month 1 | Promised | Requires chat route over existing AI context. |
| Cross-trip memory | Months 2-3 | Promised | Likely requires durable crew preference model. |
| Flight monitoring and price-drop alerts | Months 2-3 | Promised | Current flight price work does not equal monitoring unless scheduled alerts exist. |
| During-trip location-aware AI | Months 3-4 | Promised | Mobile/location trust and privacy implications. |
| Event/opportunity alerts | Months 3-4 | Promised | Requires event sourcing and relevance filtering. |
| Auto memory book PDF | Months 5-6 | Promised | Distinct from current polaroid stack. |

## Marketing Copy Guardrails

Use:

- "Trips that make it out of the group chat."
- "One paying admin covers the crew."
- "Shared plan, bookings, ledger, and chat in one place."
- "AI drafts the plan after your crew locks the destination."
- "14-day refund on first-time subscriptions."

Avoid until shipped:

- "Tripcrew books everything for you."
- "End-to-end encrypted crew chat."
- "7-day free trial."
- "Live alerts" unless monitoring is active.
- "Founders wall" as an available benefit before the route exists.
- "Unlimited" AI language unless tier gates and rate limits are explicit.

## Reconciliation Process

Before publishing new copy:

1. Add the claim to this ledger.
2. Link the code/docs that make it true.
3. Mark unshipped commitments as Promised, not Shipped.
4. Update `roadmap.md` if the promise creates a customer-facing obligation.
5. Update [docs/pricing.md](../pricing.md) when a claim affects paid tiers.
