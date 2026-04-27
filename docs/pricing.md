# Tripcrew pricing & business model

This is the canonical doc for what Crew Plus is, who pays for it, and what happens at every step of the subscription lifecycle. Anything in CLAUDE.md or other docs that contradicts this file is out of date — fix it here, then propagate.

## What Tripcrew is

Tripcrew is a planning app for group trips. A trip has one or more **admins** (organisers) and any number of **members** (the crew). Every trip moves through `planning` → `locked` → in-flight → wrap-up.

The free tier is a complete tool for organising, voting on a destination, lining up bookings, splitting expenses and chatting. The paid tier — **Crew Plus** — turns on the AI planning surfaces that scale across the whole crew on whichever trips you're an admin of.

## Pricing

| Plan | Price | Trial |
|---|---|---|
| Free | £0 | — |
| Crew Plus | £4.99 / month | 7-day free trial, card on file via Stripe Checkout |

Annual pricing (probably £39 / year ≈ 33% off) is **planned for v1.5** but not shipped. The hooks are in place — you'd just create a second Stripe price and add a toggle on `/account`.

## Who pays — the team-share model

The deliberately generous bit: **a paying admin pays for the crew**. Concretely, the gate function `hasProAccessForTrip(userId, tripId)` in [src/lib/plan.ts](../src/lib/plan.ts) returns true when **either**:

1. The asking user is on Crew Plus / trial themselves, **or**
2. **Any admin on that trip** is on Crew Plus / trial.

This produces three buyer personas:

| Persona | Why they buy |
|---|---|
| **Trip admin / organiser** | Best ROI — your whole crew gets Crew Plus on every trip you organise. The intended primary buyer. |
| **Power member** | A member on multiple trips where the admins haven't subscribed; they pay for personal access across all their trips. Non-admin members can't extend their access to others, only to themselves. |
| **Co-admin freeloader** | Two admins on the same trip — only one needs to pay; the other inherits. Working as intended. |

There's no admin gate on the Subscribe button — anyone can buy Crew Plus. The marketing on `/account` leans into the team-share angle ("Buy once for your crew") because that's the strongest pitch; non-admins still see the same panel but get less leverage out of it.

If you ever want to switch to per-seat / individual-only pricing, change `hasProAccessForTrip` to drop the admin-of-trip check (lines ~46-78). That's the single load-bearing branch.

## Free vs Crew Plus — feature matrix

| Surface | Free | Crew Plus |
|---|---|---|
| Trip creation, crew invites, role management | ✓ | ✓ |
| Destination proposals, voting, locking | ✓ | ✓ |
| Crew chat (`/feed`) | ✓ | ✓ |
| Bookings checklist | ✓ | ✓ |
| Ledger / expense splitting | ✓ | ✓ |
| Polaroid photo stack | ✓ | ✓ |
| Notifications (bell) | ✓ | ✓ |
| Lock & draft — narrative plan blob | summary blob only | full enriched plan (weather, hotels, day-by-day, book-ahead, budget) |
| Lock & draft — structured brief (hero, spec grid, schedule, activities, bookings) | not populated | populated atomically alongside the plan |
| Lock & draft — generations per trip | 1 | up to 10, plus regeneration when the brief drifts stale |
| Per-shortlisted-candidate basic plans | blocked | available — drafts every shortlisted destination so the crew votes on plans, not just place names |
| Pinned moments (AI anchors the plan around them) | recorded but ignored | honoured |
| Price refresh button | blocked | available, capped at one refresh per 4h |

Source of truth for the gate logic is [src/lib/gates.ts](../src/lib/gates.ts). A change to the matrix above means a change there too.

## Lifecycle — what happens at every transition

### Sign up
A new account starts on the **free** tier with no Stripe relationship. `profiles.stripe_subscription_status` is `null`.

### Click "Start 7-day free trial"
The `createCheckoutSession` server action ([src/lib/actions/subscription.ts](../src/lib/actions/subscription.ts)) creates a Stripe Checkout session with `subscription_data.trial_period_days: 7` and `allow_promotion_codes: true`. User is redirected to Stripe's hosted Checkout, enters card, and returns to `/account/checkout/success`.

Stripe immediately fires `customer.subscription.created` to our webhook with `status: 'trialing'`. The webhook writes:
- `stripe_customer_id`
- `stripe_subscription_id`
- `stripe_subscription_status: 'trialing'`
- `current_period_end` = trial end (7 days from now)

`get_user_plan(user_id)` returns `'pro'` for both `'trialing'` and `'active'` statuses — the gate doesn't care which phase you're in.

### During the trial
User has full Crew Plus access. They can use it for one trip and finish all the planning before the trial ends. That's fine — the trial is the value proposition.

### Cancel during trial
User opens Stripe Customer Portal via "Manage subscription", cancels. Stripe marks the subscription `cancel_at_period_end: true` and fires a `customer.subscription.updated` event. Our webhook writes status (still `trialing`) but the `current_period_end` is unchanged. At the trial end, Stripe deletes the subscription and fires `customer.subscription.deleted`; webhook writes `status: 'canceled'`. **Result: no charge, ever.**

### Trial ends without cancellation, with valid card
Stripe charges £4.99, transitions the subscription to `active`. Webhook writes `status: 'active'` and updates `current_period_end` to one month out. User keeps full access seamlessly.

### Trial ends without cancellation, with payment failure
Stripe transitions subscription to `past_due`. Webhook writes that status. The `/account` panel switches to "Payment needed — last payment failed. Update card to keep Crew Plus." Stripe automatically retries up to 4 times over a few weeks; the retry cadence is Stripe's default Smart Retries. If all retries fail, status moves to `canceled`.

### Mid-cycle cancel (during paid period)
User cancels via Customer Portal. Stripe marks `cancel_at_period_end: true`, status stays `active`, `current_period_end` is unchanged. User keeps Crew Plus until the period ends. At period end, Stripe fires `customer.subscription.deleted`; webhook writes `status: 'canceled'`. Panel switches to "Crew Plus ending DD MMM" with a Resubscribe button.

### Reactivate
`/account` "Resubscribe" button calls `createCheckoutSession` again. New subscription, new trial **only if** Stripe's eligibility logic allows it (typically once per customer). The same flow runs.

## Operational notes

**The webhook is authoritative.** Anything other than the Stripe → webhook → `profiles` path that writes `stripe_subscription_status` is a hack. The current Codex-built migration includes manual SQL flips as a recovery path — those should be rare and documented in the row's update history if used.

**`stripe_customer_id` populates on first webhook.** If a customer is created via Stripe Dashboard (admin manually adding a sub), the webhook still picks it up via the email-fallback lookup ([src/app/api/stripe/webhook/route.ts](../src/app/api/stripe/webhook/route.ts) lines 41-78).

**Founder coupon `wmc0DTCf`** (100% off, forever) exists in Stripe live mode. Apply via the dashboard for friends-and-family or via a promotion code at checkout (since `allow_promotion_codes: true` is set).

**Test mode locally**: switch `STRIPE_SECRET_KEY` to `sk_test_…` and `STRIPE_PRICE_ID` to a test-mode price. Run `stripe listen --forward-to localhost:3000/api/stripe/webhook` for the webhook signing secret. Use card `4242 4242 4242 4242` to simulate a successful trial start.

## Open questions / tracked debt

- **Annual pricing** — biggest retention lever; should be v1.5.
- **Pause-subscription self-serve** — Stripe Customer Portal can be configured to allow pausing instead of cancelling (configurable in dashboard); enable this when you're comfortable with the feature.
- **Trial extensions / win-back flows** — if churn is high after trial, consider a "extend trial 7 days" lever for users who haven't activated AI features yet.
- **Per-seat/team plans** — if a single trip ever needs Crew Plus on behalf of multiple crews, the team-share model breaks down. Not a current need.
