# TripCrew

TripCrew is a Next.js + Supabase app for planning group trips with a shared crew. It covers destination voting, bookings, crew management, pooled expenses, trip updates, and invite-based membership.

## What the app does

- Auth with Supabase email/password and magic links
- Dashboard of trips the signed-in user belongs to
- New trip creation with optional destination candidates and vote deadline
- Destination proposal and yes/maybe/no voting, with admin lock-in
- Trip overview with editable hero, spec grid, and schedule
- Crew page with invite links and admin role management
- Shared bookings checklist
- Shared expense ledger with per-person budget tracking
- Trip feed for posts and updates
- Realtime updates for collaborative tables via Supabase Realtime

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase auth, Postgres, RLS, and Realtime
- Playwright + axe-core for smoke and accessibility coverage
- Mapbox Search Box API for destination autocomplete when configured

## Main routes

- `/sign-in`: sign in, sign up, or request a magic link
- `/`: trip dashboard
- `/trips/new`: create a trip
- `/trips/[slug]/destinations`: destination proposal and voting
- `/trips/[slug]`: trip overview once a destination is locked
- `/trips/[slug]/crew`: members and invite links
- `/trips/[slug]/shortlist`: activity shortlist and voting
- `/trips/[slug]/bookings`: shared bookings tracker
- `/trips/[slug]/ledger`: shared expense ledger
- `/trips/[slug]/feed`: crew chat — messages, photos, replies, likes
- `/trips/[slug]/admin`: admin-only trip configuration
- `/join/[token]`: accept an invite link

## Security

Crew chat messages are **not end-to-end encrypted.** Posts live in Supabase Postgres (TLS in transit, standard at-rest encryption), and RLS restricts reads to trip members. Supabase infrastructure and anyone holding the service-role key can read message contents. Treat the chat as a shared workspace surface, not a private messenger.

## Repository shape

- `src/app`: App Router pages, layouts, auth flow, and route groups
- `src/components`: feature UI and shared primitives
- `src/lib/actions`: server actions for trips, destinations, invites, bookings, ledger, feed, and shortlist
- `src/lib/supabase`: browser/server/middleware Supabase clients
- `src/hooks`: realtime table subscription and toast helpers
- `schema.sql`: baseline schema and seed reference
- `supabase/migrations`: current Supabase schema source of truth
- `scripts/setup-test-user.ts`: idempotent Playwright user bootstrap
- `tests`: Playwright smoke and accessibility tests

## Prerequisites

- Node.js 20+
- `pnpm`
- A Supabase project

## Environment variables

Copy `.env.example` to `.env.local` and fill in the required values.

Required for the app:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Optional for destination autocomplete:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=
```

Optional for the AI draft ("Lock & draft") beta feature. All three keys are required to enable; without them the AI CTA stays hidden:

```bash
GEMINI_API_KEY=          # from https://aistudio.google.com/apikey
GOOGLE_PLACES_API_KEY=   # GCP project with Places API (New) + billing
AI_BETA_OWNER_EMAIL=     # email allowed to view /ai-usage cost dashboard
```

To flip a user into the beta: in Supabase Studio, `update profiles set ai_enabled = true where id = '<user-uuid>'`.

Needed for local Playwright auth setup:

```bash
TEST_USER_EMAIL=
TEST_USER_PASSWORD=
TEST_TRIP_SLUG=
```

Optional for Supabase CLI usage:

```bash
SUPABASE_ACCESS_TOKEN=
SUPABASE_DB_PASSWORD=
```

## Local setup

1. Install dependencies:

```bash
pnpm install
```

2. Create `.env.local` from `.env.example` and fill in Supabase credentials.

3. Apply the database schema:
   Prefer the SQL files in `supabase/migrations`, which reflect the current app model including multi-trip support, invites, destination voting, trip metadata, and currency fields.

4. Optional baseline/reference seed:
   `schema.sql` is still useful as a compact reference and includes sample seed data, but it does not reflect every newer migration-backed table/column used by the app.

5. Start the app:

```bash
pnpm dev
```

6. Open `http://localhost:3000`.

## Authentication flow

- Unauthenticated users are redirected to `/sign-in` by middleware.
- Sign-up creates a Supabase auth user, then redirects to `/profile` to complete the display name.
- Magic-link sign-in uses `/callback`.
- Invite links can be opened while signed out; after sign-in the app completes invite acceptance and joins the trip.

## Data model summary

Core entities used by the current app include:

- `profiles`
- `trips`
- `trip_members`
- `destination_candidates`
- `destination_votes`
- `activities`
- `votes`
- `bookings`
- `expenses`
- `posts`
- `trip_invites`
- `notifications`
- `ai_usage`
- `ai_feedback`
- `ai_draft_versions`

Trip membership is role-based (`admin` or `member`), and most tables are protected by RLS so members only access data for trips they belong to.

## Realtime behavior

The app subscribes to Supabase Realtime for collaborative updates. Current realtime-backed tables include trip membership, votes, bookings, expenses, and posts.

## Scripts

```bash
pnpm dev
pnpm build
pnpm start
pnpm seed
pnpm test:setup
pnpm test
pnpm test:report
```

Notes:

- `pnpm seed` currently acts as a database probe against the configured Supabase project and prints counts plus discovered trips.
- `schema.sql` contains baseline seed data; the live schema has continued in `supabase/migrations`.
- `pnpm test:setup` creates or updates the Playwright test user and ensures membership on the configured test trip.

## Testing

Playwright is configured to run against the local dev server at `http://localhost:3000`.

Run the test-user setup first if needed:

```bash
pnpm test:setup
```

Run the suite:

```bash
pnpm test
```

Open the HTML report:

```bash
pnpm test:report
```

The suite includes:

- smoke coverage across the main authenticated routes
- an accessibility sweep using axe-core on the main UI surfaces

## Notes

- `next.config.ts` is set up for Codespaces/dev-origin support.
- If `NEXT_PUBLIC_MAPBOX_TOKEN` is missing, destination proposal still works with plain text input; autocomplete is simply disabled.
