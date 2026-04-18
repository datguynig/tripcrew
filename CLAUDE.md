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
| `/trips/[slug]/feed` | Trip posts |
| `/trips/[slug]/admin` | Admin-only trip configuration |
| `/join/[token]` | Invite acceptance |
| `/account` | User account settings |

Middleware redirects unauthed users on `(app)` routes to `/sign-in`.

## Data model

Tables (see [src/lib/types.ts](src/lib/types.ts) for TS shapes and [supabase/migrations/](supabase/migrations/) for DDL):

- `profiles` — one row per auth user; `ai_enabled` gates the closed-beta AI draft feature
- `trips` — status enum (`planning` | `locked`); holds `hero_title`, `hero_subtitle`, `city_label`, `dates_label`, `target_budget_pp`, `target_crew_size`, `currency`, `vote_deadline`, `start_date`, `end_date`, `ai_drafted_at`, and a `meta` jsonb (`spec_grid`, `schedule`, `section_leads`)
- `trip_members` — `(trip_id, user_id, role)`
- `trip_invites` — tokenized invite links; email optional
- `destination_candidates` — proposals; optional Mapbox `mapbox_id`, `longitude`, `latitude`, `country`
- `destination_votes` — yes/maybe/no per candidate per user
- `activities` + `votes` — shortlist items + user votes; activities track `ai_drafted`
- `bookings` — checklist items; any member can edit/tick; rows track `ai_drafted`
- `expenses` — `paid_by` + `amount`; only payer deletes own
- `posts` — feed items; optional `image_url`
- `ai_usage` — cost telemetry per draft pass (provider, tokens, Places requests, USD)
- `ai_feedback` — thumbs up/down + optional note per AI-drafted surface

**RLS**: members only see and act on data for trips they belong to.

## Primitives

Hand-rolled in [src/components/ui/](src/components/ui/): `Button`, `Badge`, `Card`, `Field`, `Dialog`, `DatePicker`, `DateTimePicker`, `Calendar`, `MoneyInput`, `Toaster`. Shared input classes live in [src/lib/styles.ts](src/lib/styles.ts) (`INPUT`, `INPUT_SM`, `INPUT_MONO`).

## Realtime

Use [useRealtimeTable](src/hooks/useRealtimeTable.ts) for collaborative tables: initial fetch → subscribe to Postgres changes filtered by `trip_id` → reducer over INSERT/UPDATE/DELETE. Unsubscribe on unmount.

Realtime-backed tables: `trip_members`, `destination_candidates`, `destination_votes`, `votes`, `bookings`, `expenses`, `posts`.

## Server actions

Grouped in [src/lib/actions/](src/lib/actions/) by feature: `trips.ts`, `destinations.ts`, `bookings.ts`, `ledger.ts`, `feed.ts`, `shortlist.ts`, `invites.ts`, `acceptInvite.ts`, `aiDraft.ts`. Every action validates input with Zod before touching the DB.

## AI draft ("Lock & draft")

Closed-beta feature. Once a trip admin locks a destination, an admin with `profiles.ai_enabled = true` sees a single CTA that fires one bundled pass through Gemini 3 Flash Preview + Google Places to populate hero, spec grid, schedule, activities, and suggested bookings. Drafts land directly in the existing tables with `ai_drafted = true` markers (no accept/reject flow); users edit in place.

- AI wrapper: [src/lib/ai.ts](src/lib/ai.ts) — Gemini via `@google/genai` with `searchPlaces` tool-use loop + Zod-validated JSON output. Swappable to Claude Haiku via the same `DraftResult` interface.
- Places wrapper: [src/lib/places.ts](src/lib/places.ts) — Google Places (New) Text Search + Details, tight field mask for cost control.
- Rate limit: [src/lib/rateLimit.ts](src/lib/rateLimit.ts) — DB-backed via `ai_usage` (2 drafts per trip per 24h, 1 per user per hour).
- Gating: flip `profiles.ai_enabled` in Supabase Studio. No Stripe, no paywall, no subscription code yet.
- Cost telemetry: `ai_usage` table; owner views `/ai-usage` (gated by `AI_BETA_OWNER_EMAIL` env).
- Env vars needed: `GEMINI_API_KEY`, `GOOGLE_PLACES_API_KEY`, `AI_BETA_OWNER_EMAIL`.

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

- Direct image uploads for feed posts (currently: paste URLs)
- Push notifications
- Multi-currency within one trip's ledger (currently: trip has one currency)
- Receipt OCR, per-item splits, weighted splits
- Activity creation by non-admin members (currently: activities are admin-seeded)
