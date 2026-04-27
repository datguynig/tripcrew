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
