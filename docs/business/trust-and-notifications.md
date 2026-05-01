# Trust, Security, And Notifications

Last updated: 2026-04-28

This doc is the business-facing trust posture for Yenkoh. It is not a full security audit; it is the language and operational model founders should use when explaining what the app does and does not guarantee.

## Trust Boundary

Yenkoh is a shared planning workspace for a trip crew. The right comparison is a shared Google Doc plus planning tools, not an end-to-end encrypted messenger or a banking app.

Core protections:

- Supabase Auth controls identity.
- RLS restricts trip data to members of that trip.
- Admin/member roles constrain sensitive actions.
- Service-role writes are server-side only.
- Storage buckets and upload paths are scoped by app logic.
- Founder-only admin routes rely on `is_founder` checks.

Core limitations:

- Crew chat is not end-to-end encrypted.
- Supabase infrastructure and anyone with the service-role key can access stored content.
- The ledger is coordination software, not regulated financial infrastructure.
- Bookings are checklist items, not actual booking execution.
- Notifications are in-app, not push notifications.

## Customer-Safe Language

Use:

- "Private to your trip crew."
- "Protected by account access and trip membership."
- "Shared workspace for your crew's plans, costs, bookings, and updates."
- "Crew chat is stored in Yenkoh so the plan stays with the trip."

Avoid:

- "Encrypted messenger."
- "Bank-grade expense settlement."
- "We book everything for you."
- "Guaranteed live alerts."
- "Private from Yenkoh."

## Notification Model

Notifications are app-level rows delivered through Supabase Realtime. They currently cover:

- Crew joined.
- Destination locked.
- Trip drafted.
- Expense added.
- Role changed.
- Candidate proposed.
- Feed message.

Feed message notifications are coalesced by actor and trip, and respect per-trip feed mute preferences.

## Support Playbooks

### User Says They Cannot See A Trip

1. Confirm they are signed in as the expected account.
2. Check `trip_members` for the trip and user.
3. Check invite acceptance state if they joined through `/join/[token]`.
4. Do not bypass membership manually without confirming the trip admin intended access.

### User Says Someone Saw Private Content

1. Identify the trip, user, content type, and timestamp.
2. Check membership history and role changes.
3. Check whether the content was shared through a public/sample/curated route instead of the app.
4. If membership was incorrect, revoke access and document the incident.

### User Asks To Delete Content

1. Identify the content owner and trip.
2. Confirm whether product UI already supports deletion.
3. For manual deletion, preserve audit notes outside customer-visible content.
4. Do not delete unrelated trip data for other crew members without a clear policy decision.

## Public Policy Gaps

These should exist before broad launch:

- Privacy policy covering stored trip content, chat, AI inputs, Places/media enrichment, and Stripe.
- Terms covering invited crews, user-generated content, acceptable use, cancellations, and refunds.
- Security contact path.
- Data deletion/export process.

## Founder Admin Access

Founder/admin tools are powerful because they can view applications and operate launch workflows. Keep these principles:

- Use `is_founder` for application/admin surfaces.
- Keep founder access separate from trip admin access.
- Avoid adding broad admin powers to regular trip admins.
- Log or document manual interventions during launch, especially billing and access fixes.
