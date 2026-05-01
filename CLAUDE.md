# Yenkoh — Project Memory

## What this is

Yenkoh (Twi for "let's go") is a Next.js + Supabase app for planning group trips with a shared crew. Multi-trip, role-based (`admin` / `member`), realtime-collaborative. Each trip moves through a `planning` → `locked` lifecycle: members propose and vote on destinations, an admin locks the winner, then the trip surfaces an overview with spec grid, schedule, crew, bookings, ledger, feed.

DB identifiers (`crew_plus` enum value, `founding_crew_at` column, `STRIPE_FOUNDING_PRICE_ID` env var) date from the original Tripcrew project name; left in place to avoid migration churn. User-facing copy uses Yenkoh + Member + Pioneer instead.

## Companion docs

- [README.md](README.md) — setup, env vars, scripts
- [designsystem.md](designsystem.md) — **authoritative** visual rules, tokens, type scale
- [supabase/migrations/](supabase/migrations/) — **authoritative** schema
- [docs/archive/CLAUDE_v2.md](docs/archive/CLAUDE_v2.md) — historical v1→v2 transition brief, kept for idea-mining

## Stack (locked)

- **Next.js 16** App Router, RSC by default
- **React 19**
- **TypeScript** strict — no `any`; use `unknown` and narrow
- **Tailwind CSS v4** with tokens in `src/app/globals.css` under `@theme`
- **Supabase**: Postgres, Auth (email+password + magic link), Realtime, Storage
- **Zod** for validation at server action + API boundaries
- **Playwright + axe-core** for smoke + accessibility
- **Mapbox Search Box** — optional, behind `NEXT_PUBLIC_MAPBOX_TOKEN`; falls back to plain text input
- **pnpm**

Avoid: other UI libraries, CSS-in-JS runtimes, client state libs (Zustand, Redux), shadcn (primitives are hand-rolled in [src/components/ui/](src/components/ui/)).

## Conventions

- **Server components by default.** Add `"use client"` only when interactivity forces it.
- **Initial data** via Supabase server client in RSCs; layer realtime subscriptions on top in client components.
- **Mutations** via Next.js server actions (`"use server"`), validated with Zod.
- **Naming**: PascalCase components, camelCase funcs/vars, kebab-case non-component files; component files match component name.
- **No comments explaining WHAT code does** — names do that. Only comment non-obvious WHY (hidden invariants, workarounds, surprising behavior).
- **Errors**: log server-side console; surface client-side via the `Toaster` primitive.
- **Tokens over hex**: colors and spacing always via Tailwind tokens defined in `@theme`. See [designsystem.md](designsystem.md) §2.
- **Primitives live in** [src/components/ui/](src/components/ui/) — feature code composes around them, never hand-rolls a Button/Field/Dialog.
- **Force-dynamic on authed routes** — add `export const dynamic = "force-dynamic"` to avoid `notFound()` caching under RSC.

## Routes

| Path | Purpose |
| --- | --- |
| `/sign-in` | Email+password, sign-up, or magic-link request |
| `/callback` | Supabase auth callback |
| `/profile` | First-login display-name capture |
| `/sign-out` | Clears session |
| `/` | Trip dashboard (list of user's trips) |
| `/trips/new` | Create trip |
| `/trips/[slug]` | Overview (redirects to `/destinations` when `status === "planning"`) |
| `/trips/[slug]/destinations` | Propose + vote on candidates; admin locks winner |
| `/trips/[slug]/crew` | Members + invite links |
| `/trips/[slug]/shortlist` | Activity shortlist + voting |
| `/trips/[slug]/bookings` | Shared bookings checklist |
| `/trips/[slug]/ledger` | Shared expenses + per-person balances |
| `/trips/[slug]/feed` | Crew chat — messages, photos, likes, replies |
| `/trips/[slug]/admin` | Admin-only trip configuration |
| `/join/[token]` | Invite acceptance |
| `/account` | User account settings |
| `/ai-usage` | AI cost dashboard (gated by `AI_BETA_OWNER_EMAIL`) |

Middleware redirects unauthed users on `(app)` routes to `/sign-in`.

## Data model

Tables (see [src/lib/types.ts](src/lib/types.ts) for TS shapes and [supabase/migrations/](supabase/migrations/) for DDL):

- `profiles` — one row per auth user; carries Stripe billing state
- `trips` — status enum (`planning` | `locked`); holds `hero_title`, `hero_subtitle`, `city_label`, `dates_label`, `target_budget_pp`, `target_crew_size`, `currency`, `vote_deadline`, `start_date`, `end_date`, `ai_drafted_at`, `hero_image_url` + `hero_image_attribution` (Google Places photo of the locked destination), `hero_image_user_url` (admin-uploaded hero override), `hero_tint` (dominant-colour `rgba(...)` used by `.trip-ambient`), `enriched_draft` + `enriched_draft_tier` + `enriched_draft_generated_at` (the unified Lock & Draft output), and a `meta` jsonb (`spec_grid`, `schedule`, `section_leads`, `ai_preferences`, `polaroid_slots`, `brief_updated_at`)
- `trip_members` — `(trip_id, user_id, role)`
- `trip_invites` — tokenized invite links; email optional
- `destination_candidates` — proposals; optional Mapbox `mapbox_id`, `longitude`, `latitude`, `country`; optional `photo_url` + `photo_attribution` (Places photo cached in the `place-photos` storage bucket, fetched fire-and-forget after propose)
- `destination_votes` — yes/maybe/no per candidate per user
- `activities` + `votes` — shortlist items + user votes; activities track `ai_drafted`, and carry optional `photo_url` / `photo_attribution` / `rating` / `price_level` / `website_url` from Places enrichment (Phase 4 of media rollout — not yet surfaced on the card UI)
- `bookings` — checklist items; any member can edit/tick; rows track `ai_drafted`
- `expenses` — `paid_by` + `amount`; only payer deletes own
- `posts` — crew-chat messages; optional `image_url`, optional `caption`, optional `reply_to_post_id` (quotes a parent), `edited_at` stamp when the author edits within the 5-min window
- `post_likes` — `(post_id, user_id)` composite PK; reactions on crew-chat messages
- `trip_notification_prefs` — per-user per-trip notification preferences, currently `feed_muted`
- `ai_usage` — cost telemetry per draft pass (provider, tokens, Places requests, USD)
- `notifications` — one row per (recipient, event); `kind` is app-level typed by `NotificationKind`, delivered via Supabase Realtime

**RLS**: members only see and act on data for trips they belong to.

## Media enrichment

Google Places Photo API powers destination imagery end-to-end. Flow: propose with Mapbox coords → `enrichPlace` (src/lib/placeEnrichment.ts) searches Places near those coords → downloads the top result's first photo into the `place-photos` Supabase Storage bucket → persists URL + photographer attribution on the row. Tint extraction via `sharp.stats().dominant` runs on the same buffer (free), stored on `trips.hero_tint` at lock-time. Backfill via `pnpm backfill:media` is idempotent.

**Per-trip ambient.** `.trip-ambient` on the trip layout wrapper (src/app/(app)/trips/[slug]/layout.tsx) renders a soft radial wash at the top of the viewport, coloured from `trips.hero_tint` via the `--trip-tint` CSS var. Fallback to accent coral for planning trips. See designsystem.md §4.17.

**Glass is selective, not default.** Only sticky chrome (TopBar, Nav, MessageComposer) and the destination candidate cards use `bg-X/Y backdrop-blur-md`. Everything else stays flat `bg-bg-2` per the editorial-brutalist baseline. See designsystem.md §4.16.

**Polaroid stack on the overview hero.** The locked-trip overview renders a tilted stack of up to 5 polaroids in the right column of Block A (text left, stack right; stacks vertically below 900px). Slots are auto-composed server-side in [src/app/(app)/trips/[slug]/page.tsx](src/app/(app)/trips/[slug]/page.tsx): slot 0 = destination photo, slots 1–3 = top shortlisted activities with `photo_url`, slot 4 = most recent crew upload from `posts`. Admins override any slot via `trips.meta.polaroid_slots: PolaroidOverride[]` — no migration; see `PolaroidOverride` in [src/lib/types.ts](src/lib/types.ts). Writes go through `setPolaroidSlot` in [src/lib/actions/overviewInline.ts](src/lib/actions/overviewInline.ts), which validates the override URL against our three storage buckets (`trip-hero-images`, `post-images`, `place-photos`) to prevent arbitrary-URL injection. Admin UI exposes two per-polaroid affordances: **SWAP** opens [PolaroidSlotPicker](src/components/overview/PolaroidSlotPicker.tsx) (Upload / Activities / Gallery tabs + reset-to-auto) to change that slot's content; **↔** opens [PolaroidSwapDialog](src/components/overview/PolaroidSwapDialog.tsx) to exchange two slot positions. Tap any polaroid → [PolaroidLightbox](src/components/overview/PolaroidLightbox.tsx) for a full-screen view. See designsystem.md §4.18.

**Activity photo enrichment** runs via `scripts/backfill-media.ts` (pass 4): for each `ai_drafted` activity with a null `photo_url`, looks up its trip's winning destination candidate coords, runs Places `searchText` within 25 km, downloads the top photo. ~$0.04/activity. Enrichment is not yet wired into the unified Lock & Draft action — new AI-drafted trips still rely on a manual backfill pass.

## Primitives

Hand-rolled in [src/components/ui/](src/components/ui/): `Button`, `Badge`, `Card`, `Field`, `Dialog`, `DatePicker`, `DateRangePicker`, `DateTimePicker`, `Calendar`, `RangeCalendar`, `MoneyInput`, `InlineEdit`, `InlineMoneyEdit`, `InlineTextarea`, `ProgressRail`, `Skeleton`, `Toaster`. Shared input classes live in [src/lib/styles.ts](src/lib/styles.ts) (`INPUT`, `INPUT_SM`, `INPUT_MONO`, `INPUT_TRIGGER` for picker buttons, `INPUT_PADDING` for composites).

## Realtime

Use [useRealtimeTable](src/hooks/useRealtimeTable.ts) for collaborative tables: initial fetch → subscribe to Postgres changes filtered by `trip_id` → reducer over INSERT/UPDATE/DELETE. Unsubscribe on unmount.

Realtime-backed tables: `trip_members`, `destination_candidates`, `destination_votes`, `votes`, `bookings`, `expenses`, `posts`, `post_likes`, `notifications`, `trip_notification_prefs`.

## Server actions

Grouped in [src/lib/actions/](src/lib/actions/) by feature: `trips.ts`, `destinations.ts`, `bookings.ts`, `ledger.ts`, `feed.ts`, `shortlist.ts`, `invites.ts`, `acceptInvite.ts`, `lockAndDraft.ts`, `draftCandidates.ts`, `tripPreferences.ts`, `airports.ts`, `notifications.ts`, `overviewInline.ts`. Every action validates input with Zod before touching the DB.

## Locking a trip

The "Lock destination" button on `/trips/[slug]/destinations` opens the **Lock & Draft dialog** ([LockAndDraftDialog.tsx](src/components/destinations/LockAndDraftDialog.tsx)). The dialog confirms the lock, captures rich AI preferences (origin, crew size, budget, vibes, occasion, notes, pinned moments) via the shared [TripPreferencesForm.tsx](src/components/trips/TripPreferencesForm.tsx), and ends with two CTAs: **"Lock & start drafting →"** runs `lockAndStartDraft` ([destinations.ts](src/lib/actions/destinations.ts)) which atomically saves prefs to `meta.ai_preferences`, locks the destination, and fires `generateLockAndDraft` via `after()`; **"Lock without drafting"** does the lock + prefs save without firing the AI.

`generateLockAndDraft` ([lockAndDraft.ts](src/lib/actions/lockAndDraft.ts)) runs one bundled Gemini 3 Flash Preview + Google Places pass that produces the narrative plan blob (`enriched_draft`) AND the structured brief (hero copy, spec grid, schedule, activities, bookings) in a single call. Pro tier writes both surfaces; free tier (basic draft) writes only the summary blob and shows an upsell. Per-candidate basic drafts before the lock ([draftCandidates.ts](src/lib/actions/draftCandidates.ts)) get the same prefs context when present.

The trip overview surfaces the brief and plan as a sequence: brief is collapsed under a 1-line summary chip once the plan exists ([CollapsibleSection.tsx](src/components/ui/CollapsibleSection.tsx)). Editing any brief field bumps `meta.brief_updated_at`; if that's newer than `enriched_draft_generated_at`, a soft "Brief changed — regenerate the plan?" banner appears on §02 with a STALE tag on the plan content.

- AI wrapper: [src/lib/ai/gemini.ts](src/lib/ai/gemini.ts) — Gemini via `@google/genai` with Zod-validated JSON output via [src/lib/ai/schema.ts](src/lib/ai/schema.ts).
- Prompts: [src/lib/ai/prompts.ts](src/lib/ai/prompts.ts) — `buildEnrichedDraftPrompt` projects vibes/occasion/notes/pins into a PINNED MOMENTS section the model anchors the schedule around.
- Places wrapper: [src/lib/places/](src/lib/places/) — Google Places (New) orchestrator + tight field mask for cost control.
- Gating: plan-tier based — see §Billing below.
- Cost telemetry: `ai_usage` table; owner views `/ai-usage` (gated by `AI_BETA_OWNER_EMAIL` env).
- Env vars needed for drafting: `GEMINI_API_KEY`, `GOOGLE_PLACES_API_KEY`. `AI_BETA_OWNER_EMAIL` only gates `/ai-usage`.

## Billing

Pricing model, who-pays rules, lifecycle and gate matrix all live in **[docs/pricing.md](docs/pricing.md)** — that's the canonical doc, keep it in sync.

Implementation pointers:

- Plan resolver: [src/lib/plan.ts](src/lib/plan.ts) (`getUserPlan`, `hasProAccessForTrip` — the team-share gate)
- Gates: [src/lib/gates.ts](src/lib/gates.ts) (`canGenerateDraft`, `canDraftCandidates`, `canRefreshPrices`)
- Stripe webhook: [src/app/api/stripe/webhook/route.ts](src/app/api/stripe/webhook/route.ts) — sole writer of `profiles.stripe_subscription_status`. Handles `customer.subscription.created` / `.updated` / `.deleted`, verifies signature against `STRIPE_WEBHOOK_SECRET`, writes via service-role client. Coerces Stripe's full status set to `(active, trialing, past_due, canceled, incomplete)`. `trialing` remains supported for legacy/Stripe-created rows, but Cohort 01 no longer markets or creates a free-trial subscription.
- Checkout + Customer Portal: [src/lib/actions/subscription.ts](src/lib/actions/subscription.ts) (`createCheckoutSession`, `createBillingPortalSession`)
- /account UI: [src/components/account/SubscriptionPanel.tsx](src/components/account/SubscriptionPanel.tsx) — branches per status

Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `STRIPE_FOUNDING_PRICE_ID`. Local dev uses `stripe listen --forward-to localhost:3000/api/stripe/webhook` for the webhook signing secret.

## Notifications

In-app realtime feed surfaced via the topbar bell. Fan-out happens inside the server actions that trigger events — one row per recipient inserted with the service-role client, then Supabase Realtime pushes to each user's bell.

Seven `kind` values (union enforced in [src/lib/types.ts](src/lib/types.ts)):

- `crew_joined` — someone accepted an invite or was added to the trip
- `destination_locked` — admin locked the winning destination
- `trip_drafted` — admin ran Lock & draft
- `expense_added` — expense logged to the ledger
- `role_changed` — member promoted, demoted, or removed
- `candidate_proposed` — new destination candidate proposed
- `feed_message` — new crew-chat post (message, photo, or reply). Coalesced per `(recipient, trip, actor)` — a burst from one person collapses to one bell row carrying the most recent excerpt.

Pointers: [src/lib/actions/notifications.ts](src/lib/actions/notifications.ts) (`listRecent`, `markAsRead`, `markAllRead`), migration [20260419220000_notifications.sql](supabase/migrations/20260419220000_notifications.sql). Unread-count query is backed by a partial index on `read_at is null` so the bell stays fast even with thousands of read rows. Mark-read writes use the service role — the SSR client verifies the user and the update is scoped to `user_id = auth.uid()` in the query (the RLS update policy was removed; see [20260419230000_notifications_tighten_rls.sql](supabase/migrations/20260419230000_notifications_tighten_rls.sql)).

Coalescing: `createNotifications` takes `coalesceByActorAndTrip: true` to delete any prior unread rows for `(recipient, trip, actor, kind)` before inserting. Used by `feed_message` so a chatty crew member doesn't flood every other crew member's bell. Payload always reflects the most recent event. Feed-message fanout respects `trip_notification_prefs.feed_muted`; muting a trip's crew chat also marks the existing unread feed-message backlog as read.

## Crew chat

Per-trip realtime chat surfaced at `/trips/[slug]/feed`. Replaces WhatsApp-style coordination with a timeline that stays bound to the trip.

- Posts table is the one source of truth for messages. Text, photo, reply-to, or any combination. `reply_to_post_id` quotes a parent (on delete set null — replies survive the parent being deleted). `edited_at` stamps edits; RLS and column grants allow updates only on `(caption, edited_at)` within 5 min of creation.
- Likes live in `post_likes`, composite PK, silent (no notification). Optimistic toggle on click.
- Realtime: [Feed.tsx](src/components/feed/Feed.tsx) subscribes once to `posts` (filtered by trip) + `post_likes` (client-filtered). The bubble body, footer, and reply-quote all derive from local state.
- Notifications: every message fires a `feed_message` fanout to every unmuted crew member, coalesced per actor. Clicking the bell row deep-links to `/trips/[slug]/feed#post-<id>` and the timeline hash-scrolls + flashes `bg-accent-dim` for 1.2s.
- Composer: [MessageComposer.tsx](src/components/feed/MessageComposer.tsx). Auto-grow textarea, Enter = send, Shift+Enter = newline. "Add photo" is a `<label>` wrapping an `sr-only` file input (tab-focusable without custom key handlers). Reply-quote and image chips stack above the textarea.
- Initial fetch in [feed/page.tsx](src/app/(app)/trips/[slug]/feed/page.tsx) caps at 200 rows. Infinite-scroll history is not wired yet.

**Security posture.** Messages are **not end-to-end encrypted.** Posts live in Supabase Postgres with TLS in transit and standard at-rest encryption; RLS restricts reads to trip members. Supabase infrastructure and anyone with the service-role key can read message contents. Don't use crew chat for sensitive data, and treat it as the same trust boundary as a shared Google Doc, not an E2E messenger.

## Running

```bash
pnpm install
# Fill .env.local (see README)
pnpm dev
```

## Testing

```bash
pnpm test:setup   # idempotent Playwright user bootstrap
pnpm test          # smoke + a11y suites
pnpm test:report   # HTML report
```

Smoke covers main authed routes; a11y sweeps the same surfaces with axe-core.

## Features for future consideration

Not built yet, not currently planned — picks for the next plan, or to fill space between plans.

- Push notifications (in-app notifications already ship — see §Notifications)
- Multi-currency within one trip's ledger (currently: trip has one currency)
- Receipt OCR, per-item splits, weighted splits
- Activity creation by non-admin members (currently: activities are admin-seeded)
- Infinite-scroll older chat history (currently: last 200 messages on load)
