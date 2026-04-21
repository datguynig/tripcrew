# Tripcrew — Project Memory

## What this is

Tripcrew is a Next.js + Supabase app for planning group trips with a shared crew. Multi-trip, role-based (`admin` / `member`), realtime-collaborative. Each trip moves through a `planning` → `locked` lifecycle: members propose and vote on destinations, an admin locks the winner, then the trip surfaces an overview with spec grid, schedule, crew, bookings, ledger, feed.

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

- `profiles` — one row per auth user; `ai_enabled` gates the closed-beta AI draft feature
- `trips` — status enum (`planning` | `locked`); holds `hero_title`, `hero_subtitle`, `city_label`, `dates_label`, `target_budget_pp`, `target_crew_size`, `currency`, `vote_deadline`, `start_date`, `end_date`, `ai_drafted_at`, `hero_image_url` + `hero_image_attribution` (Google Places photo of the locked destination), `hero_tint` (dominant-colour `rgba(...)` used by `.trip-ambient`), and a `meta` jsonb (`spec_grid`, `schedule`, `section_leads`)
- `trip_members` — `(trip_id, user_id, role)`
- `trip_invites` — tokenized invite links; email optional
- `destination_candidates` — proposals; optional Mapbox `mapbox_id`, `longitude`, `latitude`, `country`; optional `photo_url` + `photo_attribution` (Places photo cached in the `place-photos` storage bucket, fetched fire-and-forget after propose)
- `destination_votes` — yes/maybe/no per candidate per user
- `activities` + `votes` — shortlist items + user votes; activities track `ai_drafted`, and carry optional `photo_url` / `photo_attribution` / `rating` / `price_level` / `website_url` from Places enrichment (Phase 4 of media rollout — not yet surfaced on the card UI)
- `bookings` — checklist items; any member can edit/tick; rows track `ai_drafted`
- `expenses` — `paid_by` + `amount`; only payer deletes own
- `posts` — crew-chat messages; optional `image_url`, optional `caption`, optional `reply_to_post_id` (quotes a parent), `edited_at` stamp when the author edits within the 5-min window
- `post_likes` — `(post_id, user_id)` composite PK; reactions on crew-chat messages
- `ai_usage` — cost telemetry per draft pass (provider, tokens, Places requests, USD)
- `ai_feedback` — thumbs up/down + optional note per AI-drafted surface
- `ai_draft_versions` — pre-write snapshots of AI-drafted surfaces (`spec_grid`, `schedule`, `activities`, `bookings`, `full`) for restore; admin-only RLS
- `notifications` — one row per (recipient, event); `kind` is open text, delivered via Supabase Realtime

**RLS**: members only see and act on data for trips they belong to.

## Media enrichment

Google Places Photo API powers destination imagery end-to-end. Flow: propose with Mapbox coords → `enrichPlace` (src/lib/placeEnrichment.ts) searches Places near those coords → downloads the top result's first photo into the `place-photos` Supabase Storage bucket → persists URL + photographer attribution on the row. Tint extraction via `sharp.stats().dominant` runs on the same buffer (free), stored on `trips.hero_tint` at lock-time. Backfill via `pnpm backfill:media` is idempotent.

**Per-trip ambient.** `.trip-ambient` on the trip layout wrapper (src/app/(app)/trips/[slug]/layout.tsx) renders a soft radial wash at the top of the viewport, coloured from `trips.hero_tint` via the `--trip-tint` CSS var. Fallback to accent coral for planning trips. See designsystem.md §4.17.

**Glass is selective, not default.** Only sticky chrome (TopBar, Nav, MessageComposer) and the destination candidate cards use `bg-X/Y backdrop-blur-md`. Everything else stays flat `bg-bg-2` per the editorial-brutalist baseline. See designsystem.md §4.16.

**Polaroid stack on the overview hero.** The locked-trip overview renders a tilted stack of up to 5 polaroids in the right column of Block A (text left, stack right; stacks vertically below 900px). Slots are auto-composed server-side in [src/app/(app)/trips/[slug]/page.tsx](src/app/(app)/trips/[slug]/page.tsx): slot 0 = destination photo, slots 1–3 = top shortlisted activities with `photo_url`, slot 4 = most recent crew upload from `posts`. Admins override any slot via `trips.meta.polaroid_slots: PolaroidOverride[]` — no migration; see `PolaroidOverride` in [src/lib/types.ts](src/lib/types.ts). Writes go through `setPolaroidSlot` in [src/lib/actions/overviewInline.ts](src/lib/actions/overviewInline.ts), which validates the override URL against our three storage buckets (`trip-hero-images`, `post-images`, `place-photos`) to prevent arbitrary-URL injection. Admin UI exposes two per-polaroid affordances: **SWAP** opens [PolaroidSlotPicker](src/components/overview/PolaroidSlotPicker.tsx) (Upload / Activities / Gallery tabs + reset-to-auto) to change that slot's content; **↔** opens [PolaroidSwapDialog](src/components/overview/PolaroidSwapDialog.tsx) to exchange two slot positions. Tap any polaroid → [PolaroidLightbox](src/components/overview/PolaroidLightbox.tsx) for a full-screen view. See designsystem.md §4.18.

**Activity photo enrichment** runs via `scripts/backfill-media.ts` (pass 4): for each `ai_drafted` activity with a null `photo_url`, looks up its trip's winning destination candidate coords, runs Places `searchText` within 25 km, downloads the top photo. ~$0.04/activity. Enrichment is not yet wired into `draftTrip` — new AI-drafted trips still rely on a manual backfill pass. Follow-up tracked in [docs/archive/CLAUDE_v2.md](docs/archive/CLAUDE_v2.md) Phase 4.

## Primitives

Hand-rolled in [src/components/ui/](src/components/ui/): `Button`, `Badge`, `Card`, `Field`, `Dialog`, `DatePicker`, `DateRangePicker`, `DateTimePicker`, `Calendar`, `RangeCalendar`, `MoneyInput`, `InlineEdit`, `InlineMoneyEdit`, `InlineTextarea`, `ProgressRail`, `Skeleton`, `Toaster`. Shared input classes live in [src/lib/styles.ts](src/lib/styles.ts) (`INPUT`, `INPUT_SM`, `INPUT_MONO`, `INPUT_TRIGGER` for picker buttons, `INPUT_PADDING` for composites).

## Realtime

Use [useRealtimeTable](src/hooks/useRealtimeTable.ts) for collaborative tables: initial fetch → subscribe to Postgres changes filtered by `trip_id` → reducer over INSERT/UPDATE/DELETE. Unsubscribe on unmount.

Realtime-backed tables: `trip_members`, `destination_candidates`, `destination_votes`, `votes`, `bookings`, `expenses`, `posts`, `post_likes`, `notifications`.

## Server actions

Grouped in [src/lib/actions/](src/lib/actions/) by feature: `trips.ts`, `destinations.ts`, `bookings.ts`, `ledger.ts`, `feed.ts`, `shortlist.ts`, `invites.ts`, `acceptInvite.ts`, `aiDraft.ts`, `airports.ts`, `notifications.ts`, `overviewInline.ts`. Every action validates input with Zod before touching the DB.

## AI draft ("Lock & draft")

Closed-beta feature. Once a trip admin locks a destination, an admin with `profiles.ai_enabled = true` sees a single CTA that fires one bundled pass through Gemini 3 Flash Preview + Google Places to populate hero, spec grid, schedule, activities, and suggested bookings. Drafts land directly in the existing tables with `ai_drafted = true` markers (no accept/reject flow); users edit in place.

- AI wrapper: [src/lib/ai.ts](src/lib/ai.ts) — Gemini via `@google/genai` with `searchPlaces` tool-use loop + Zod-validated JSON output. Swappable to Claude Haiku via the same `DraftResult` interface.
- Places wrapper: [src/lib/places.ts](src/lib/places.ts) — Google Places (New) Text Search + Details, tight field mask for cost control.
- Rate limit: [src/lib/rateLimit.ts](src/lib/rateLimit.ts) — DB-backed via `ai_usage` (2 drafts per trip per 24h, 1 per user per hour).
- Gating: flip `profiles.ai_enabled` in Supabase Studio. No Stripe, no paywall, no subscription code yet.
- Cost telemetry: `ai_usage` table; owner views `/ai-usage` (gated by `AI_BETA_OWNER_EMAIL` env).
- Version history: every force-redraft and section-redraft snapshots the pre-write state into `ai_draft_versions` before overwriting. Admins see the last 3 snapshots per surface in a popover on the AIDraftRail and can restore one; restoring snapshots the current state first so restores are themselves reversible.
- Env vars needed: `GEMINI_API_KEY`, `GOOGLE_PLACES_API_KEY`, `AI_BETA_OWNER_EMAIL`.

## Notifications

In-app realtime feed surfaced via the topbar bell. Fan-out happens inside the server actions that trigger events — one row per recipient inserted with the service-role client, then Supabase Realtime pushes to each user's bell.

Seven `kind` values (open text column; union enforced in [src/lib/types.ts](src/lib/types.ts)):

- `crew_joined` — someone accepted an invite or was added to the trip
- `destination_locked` — admin locked the winning destination
- `trip_drafted` — admin ran Lock & draft
- `expense_added` — expense logged to the ledger
- `role_changed` — member promoted, demoted, or removed
- `candidate_proposed` — new destination candidate proposed
- `feed_message` — new crew-chat post (message, photo, or reply). Coalesced per `(recipient, trip, actor)` — a burst from one person collapses to one bell row carrying the most recent excerpt.

Pointers: [src/lib/actions/notifications.ts](src/lib/actions/notifications.ts) (`listRecent`, `markAsRead`, `markAllRead`), migration [20260419220000_notifications.sql](supabase/migrations/20260419220000_notifications.sql). Unread-count query is backed by a partial index on `read_at is null` so the bell stays fast even with thousands of read rows. Mark-read writes use the service role — the SSR client verifies the user and the update is scoped to `user_id = auth.uid()` in the query (the RLS update policy was removed; see [20260419230000_notifications_tighten_rls.sql](supabase/migrations/20260419230000_notifications_tighten_rls.sql)).

Coalescing: `createNotifications` takes `coalesceByActorAndTrip: true` to delete any prior unread rows for `(recipient, trip, actor, kind)` before inserting. Used by `feed_message` so a chatty crew member doesn't flood every other crew member's bell. Payload always reflects the most recent event.

## Crew chat

Per-trip realtime chat surfaced at `/trips/[slug]/feed`. Replaces WhatsApp-style coordination with a timeline that stays bound to the trip.

- Posts table is the one source of truth for messages. Text, photo, reply-to, or any combination. `reply_to_post_id` quotes a parent (on delete set null — replies survive the parent being deleted). `edited_at` stamps edits; RLS and column grants allow updates only on `(caption, edited_at)` within 5 min of creation.
- Likes live in `post_likes`, composite PK, silent (no notification). Optimistic toggle on click.
- Realtime: [Feed.tsx](src/components/feed/Feed.tsx) subscribes once to `posts` (filtered by trip) + `post_likes` (client-filtered). The bubble body, footer, and reply-quote all derive from local state.
- Notifications: every message fires a `feed_message` fanout to every other crew member, coalesced per actor. Clicking the bell row deep-links to `/trips/[slug]/feed#post-<id>` and the timeline hash-scrolls + flashes `bg-accent-dim` for 1.2s.
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
- Per-user mute on the crew-chat bell (currently: every message fans out, coalesced but always delivered)
