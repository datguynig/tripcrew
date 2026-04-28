# Launch Command Center

Last updated: 2026-04-28

This is the operational checklist for taking Tripcrew from private build to invite-only launch. It focuses on promises, revenue, onboarding, and support readiness.

## Launch Definition

Launch means a cold visitor can:

1. Understand the product from the public site.
2. Apply or enter through a curated teaser.
3. Be approved or routed into a paid fast lane.
4. Pay through Stripe.
5. Sign in and reach a useful first-trip state.
6. Use the core loop with a crew: invite, vote, lock, draft, coordinate, and settle.

## Blockers Before Charging

- Pricing cutover complete: Crew Plus and Founding Crew production price IDs are configured, and no legacy GBP 4.99 or trial fallback is live.
- Stripe webhook verified in production for subscription created, updated, and deleted events.
- Application approval flow produces a usable invite or checkout path.
- Founding Crew count is truthful and backed by `profiles.founding_crew_at`.
- Founding Crew launch promises are either shipped or explicitly labelled as scheduled roadmap benefits.
- Account subscription panel matches public pricing copy.
- Crew chat security copy does not imply E2E encryption.
- AI usage telemetry is visible to the founder/owner route.

## Pre-Launch Checklist

### Product

- [ ] Public landing page is reachable unauthenticated.
- [ ] `/apply` validates and persists application rows.
- [ ] Application queue, analytics, and detail pages are founder-gated.
- [ ] Invite acceptance works for signed-out visitors.
- [ ] First-trip activation path avoids an empty dashboard after payment.
- [ ] Lock & Draft works on a paid-access trip with required env vars set.
- [ ] Free-tier experience remains useful without AI.

### Pricing And Billing

- [ ] `STRIPE_PRICE_ID` points to the new Crew Plus monthly price.
- [ ] Annual Crew Plus copy is not shown as purchasable unless a checkout path exists.
- [ ] `STRIPE_FOUNDING_PRICE_ID` points to the Founding Crew yearly price.
- [ ] Stripe Customer Portal is configured for cancel/update payment method flows.
- [ ] Webhook secret is configured in production.
- [ ] Test-mode purchase has been completed locally for Crew Plus.
- [ ] Test-mode purchase has been completed locally for Founding Crew.

### Data And Admin

- [ ] Supabase migrations are applied.
- [ ] Founder profile has `is_founder = true`.
- [ ] RLS policies allow only intended member/admin/founder access.
- [ ] Application lifecycle states are documented for manual review.
- [ ] Manual recovery procedure exists for failed webhook/application linkage.

### AI And Places

- [ ] `GEMINI_API_KEY` is configured.
- [ ] `GOOGLE_PLACES_API_KEY` is configured with Places API (New) and billing.
- [ ] A paid test trip can generate an enriched draft.
- [ ] `ai_usage` row is created for draft generation.
- [ ] Places/photo fallback states are acceptable when enrichment fails.

### Support And Trust

- [ ] Support inbox or founder contact route is clear.
- [ ] Privacy/trust copy matches actual storage and RLS posture.
- [ ] Known limitations are written in founder-facing docs.
- [ ] Refund/cancellation stance is defined for early customers.

## Launch-Day Watchlist

Watch these in the first 24 hours:

- Landing visits to applications started.
- Applications submitted.
- Applications approved.
- Checkout sessions created.
- Subscription webhooks received.
- Paid conversions.
- First trips created.
- Destination locks.
- AI drafts generated.
- AI failures and cost per successful draft.
- User-visible errors in auth, checkout, invite acceptance, and Lock & Draft.

## Manual Recovery Playbooks

### Stripe Paid But App Did Not Update

1. Confirm the payment/subscription in Stripe.
2. Check webhook delivery logs.
3. Check the matching `profiles` row by email.
4. If webhook failed, replay it from Stripe.
5. If replay cannot fix it, manually patch subscription fields in Supabase and document the intervention.

### Application Approved But User Cannot Enter

1. Check `applications.status`, `invite_token`, and email.
2. Confirm the welcome email was sent.
3. If needed, regenerate or resend the invite link.
4. If the user already signed up, link `applications.user_id` to the Supabase user.

### AI Draft Fails

1. Confirm env vars are present.
2. Check Gemini and Places API availability/billing.
3. Check `ai_usage` and server logs for failure type.
4. Let the admin lock without drafting if the trip needs to proceed.

## Post-Launch Review

Run after the first week:

- Which acquisition source produced paid users?
- Which application answer patterns correlated with activation?
- Where did users stall before first locked trip?
- Did AI drafts create confidence or require too much editing?
- Which public promises created support questions?
- What should be removed from the promise ledger before broader launch?
