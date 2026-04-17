# Stockholm Boys Trip — Build Brief

## Goal

Build a web app for a 5-person group trip. Users sign in, appear on a crew roster, vote on activities, claim and tick off bookings, log shared expenses with auto-calculated balances, and post to a shared photo feed. Data is live across all users via Supabase realtime.

The visual and structural reference is `prototype/stockholm_trip.html`. Copy UX, copy text, layout, and design system from it. Do not re-invent copy or information architecture.

## Tech stack (locked)

- **Next.js 15** with App Router, TypeScript, React Server Components where sensible
- **Supabase**: Postgres, Auth (email magic link), Realtime, Storage (for images later)
- **Tailwind CSS** for styling, with a custom tokens layer that mirrors the prototype
- **shadcn/ui** for base components where they fit, restyled to match the aesthetic
- **Vercel** for deployment
- **pnpm** as the package manager
- **Zod** for schema validation on server actions and API inputs

Avoid: other UI libraries, CSS-in-JS runtimes, state management libs (Zustand, Redux). Keep server state in the database and client state in React hooks.

## Prerequisites (owner handles)

Before running Claude Code, owner will have:
1. A Supabase project created at supabase.com. Project URL and anon key stored in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Service role key stored in `.env.local` as `SUPABASE_SERVICE_ROLE_KEY` for seeding.
3. Vercel account connected to GitHub.
4. A custom domain (optional, can use vercel.app subdomain for MVP).

## Quickstart

```bash
# Scaffold
pnpm create next-app@latest stockholm-trip --typescript --tailwind --app --src-dir --import-alias "@/*"
cd stockholm-trip

# Dependencies
pnpm add @supabase/supabase-js @supabase/ssr zod date-fns
pnpm add -D @types/node

# shadcn setup
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input textarea select dialog

# Run Supabase schema
# (owner will paste schema.sql into Supabase SQL editor and run it)

# Seed the trip and activities
pnpm tsx scripts/seed.ts

# Dev
pnpm dev
```

## Project structure

```
src/
  app/
    (auth)/
      sign-in/page.tsx         # magic link form
      callback/route.ts        # auth callback handler
    (app)/
      layout.tsx               # authed layout with topbar + nav
      page.tsx                 # overview
      crew/page.tsx
      shortlist/page.tsx
      bookings/page.tsx
      ledger/page.tsx
      feed/page.tsx
    layout.tsx                 # root, fonts, metadata
    globals.css                # Tailwind + design tokens
  components/
    layout/
      TopBar.tsx
      Nav.tsx
      Hero.tsx
    ui/                        # shadcn components
    overview/
      SpecGrid.tsx
      Schedule.tsx
    crew/
      CrewList.tsx
    shortlist/
      VoteRow.tsx
      VoteFilters.tsx
    bookings/
      BookingRow.tsx
      AddBooking.tsx
    ledger/
      LedgerStats.tsx
      AddExpense.tsx
      Balances.tsx
    feed/
      PostCard.tsx
      NewPost.tsx
  lib/
    supabase/
      client.ts                # browser client
      server.ts                # server client (cookies)
      middleware.ts            # session refresh
    types.ts                   # shared TS types matching DB
    utils.ts
  hooks/
    useRealtimeTable.ts        # generic realtime subscription hook
    useCurrentUser.ts
middleware.ts                  # auth guard
scripts/
  seed.ts                      # seeds trip + activities
prototype/
  stockholm_trip.html          # visual reference, do not delete
schema.sql                     # initial DB schema
```

## Design system

### Fonts

Load via `next/font/google`:
- `Inter Tight` weights 300, 400, 500, 600, 700 as `--font-sans`
- `JetBrains Mono` weights 400, 500 as `--font-mono`

Apply `Inter Tight` as the default. Use `JetBrains Mono` via `font-mono` class for all metadata, dates, codes, labels.

### Tailwind tokens

Extend `tailwind.config.ts`:

```ts
theme: {
  extend: {
    colors: {
      bg: {
        DEFAULT: '#0A0A0B',
        2: '#131315',
        3: '#1C1C1F',
      },
      fg: {
        DEFAULT: '#F0F0F0',
        2: '#A8A8AD',
        3: '#6B6B70',
        4: '#3E3E42',
      },
      accent: {
        DEFAULT: '#FF4C15',
        dim: 'rgba(255, 76, 21, 0.12)',
      },
      line: {
        DEFAULT: 'rgba(255, 255, 255, 0.08)',
        2: 'rgba(255, 255, 255, 0.14)',
      },
      ok: '#5FE388',
      warn: '#F5C451',
      err: '#FF5C5C',
    },
    fontFamily: {
      sans: ['var(--font-sans)', 'sans-serif'],
      mono: ['var(--font-mono)', 'monospace'],
    },
    letterSpacing: {
      tightest: '-0.055em',
      tighter: '-0.04em',
      tight: '-0.02em',
    },
  },
},
```

### Aesthetic principles

- Black canvas, off-white text, single accent. No gradients except the hero radial glow on the sign-in screen.
- Grid-based layout with hairline dividers (`border-line`). No shadows.
- Display type is tight-tracked and heavy. Metadata is all-caps mono with wide tracking (`tracking-[0.15em]`).
- Numbers are tabular (`font-variant-numeric: tabular-nums`) in the ledger and stats.
- Layout is max-width 1280px, 28px horizontal padding.
- Top bar and nav are sticky with `backdrop-blur-md` on semi-transparent background.

### Components to match exactly

Inspect the prototype for pixel-accurate reference:
- **Hero**: `clamp(64px, 13vw, 180px)` display, `.` period in accent color
- **Stat cells**: big number with small unit, mono label above, mono sub-caption below, hairline dividers
- **Section header**: title left aligned with "§ 0X" code on the right, lead paragraph below title
- **Vote row**: three columns on desktop (info, bar chart, buttons), stacks on mobile under 780px
- **Booking row**: checkbox, title, assignee dropdown, delete icon
- **Ledger row**: date, description + paid by, amount, delete icon

## Data model

See `schema.sql`. Summary of tables:

- `profiles` — user display data (name, joined_at). One row per auth user. Backed by `auth.users`.
- `trips` — trip records. MVP uses a single trip with slug `stockholm-2026`.
- `trip_members` — many-to-many between profiles and trips.
- `activities` — shortlist items, seeded per trip.
- `votes` — user votes on activities. Upsert on conflict.
- `bookings` — checklist items. Any member can edit or tick any booking.
- `expenses` — shared expenses. Any member can create. Only the payer can delete their own.
- `posts` — feed items with optional image URL and caption.

RLS policies enforce that users can only see and act on data for trips they are members of. Schema includes all policies.

## Feature specification

### 1. Auth

- Sign in page at `/sign-in` accepts an email. Supabase sends a magic link.
- On first sign-in, if no `profiles` row exists for the user, prompt for display name and create it.
- Auto-add the user to the `stockholm-2026` trip as a member on sign-up.
- Middleware redirects unauthenticated users to `/sign-in` for all `(app)` routes.
- A "Switch" button in the top bar signs out and clears the session.

### 2. Top bar + hero (shared layout)

- Top bar: brand dot (pulsing accent), "Boys Trip · 001" label, right-side user chip with initials avatar and name.
- Hero is on the overview page only. Shows title, meta line, subtitle, and 4-stat grid (T-Minus days, target budget, bookings progress, kitty total).
- T-Minus is computed live from 23 July 2026.
- Bookings and kitty stats query the DB and update when data changes.

### 3. Overview (`/`)

- Static-ish content. Renders:
  - `SpecGrid`: 4 cells (Base, Flights, Per head, The rule) with values from constants.
  - `Schedule`: 4 rows (Thu, Fri, Sat, Sun) with heading and body from constants.
- All copy matches the prototype exactly. Store schedule and spec in a `constants/trip.ts` file.

### 4. Crew (`/crew`)

- Lists all members of the trip, ordered by `joined_at` ascending.
- Shows index (01, 02...), name, "You" tag on the current user's row with accent tint background, join date in mono.
- If roster has fewer than 5, show "Open slot" placeholder rows for the remainder.
- Realtime: subscribe to `trip_members` inserts so the list updates live when someone joins.

### 5. Shortlist (`/shortlist`)

- Lists all activities for the trip.
- Filter pills: All / Day / Night. Default All.
- Each row: title, mono meta, vote distribution bar (yes/maybe/no with color segments), vote counts, and three buttons (YES / MEH / NO).
- Clicking the user's current vote clears it (upsert to delete).
- Ranking: activities sorted by score descending, where `score = yes*2 + maybe`.
- Realtime: subscribe to `votes` changes.

### 6. Bookings (`/bookings`)

- List of bookings, pre-seeded with 9 defaults (see `schema.sql` seeds).
- Add field at the top: text input + Add button. Enter key submits.
- Each row: checkbox (filled accent color when done), title (strikethrough + dim when done), assignee select populated with crew, delete icon.
- Any member can edit any booking. No author restriction on bookings.
- Realtime: subscribe to `bookings` changes.

### 7. Ledger (`/ledger`)

- Three stat cards at the top: Total pooled, Even split, You've covered.
- Add expense form: description, amount, Log button.
- List of expenses in reverse chronological order: date in mono, description, paid by, amount, delete icon (only visible on your own expenses).
- Balances section below the list: one row per crew member showing `paid - share`. Positive in green, negative in red, zero in dim gray. Caption below explains positive = owed back.
- Realtime: subscribe to `expenses` changes.

### 8. Feed (`/feed`)

- Form at the top: image URL (optional), caption textarea, Post button.
- Grid of posts below, newest first. Each card: optional image (4:3 aspect, object-cover, gracefully hide on 404), caption, author + date in mono footer.
- Realtime: subscribe to `posts` changes.
- Future: accept direct uploads via Supabase Storage. Not in MVP.

## Realtime

Use a single `useRealtimeTable<T>` hook that:
1. Fetches initial data via the REST API.
2. Subscribes to Postgres changes on the given table filtered by `trip_id`.
3. Updates local state on INSERT, UPDATE, DELETE.

Debounce re-renders where useful. Unsubscribe on unmount.

## Build order

Phase each step as a separate commit. Do not start the next phase until the previous works end-to-end.

1. **Scaffold**: Next.js app, Tailwind config with tokens, fonts loaded, root layout with background color and base typography set.
2. **Supabase wiring**: client + server helpers, middleware, auth callback route.
3. **Schema**: run `schema.sql` against the project. Seed the single trip and its activities via `scripts/seed.ts`.
4. **Sign-in flow**: magic link, callback, profile creation on first login, auto-add to trip.
5. **Layout**: top bar, nav, sticky behavior, user chip with initials.
6. **Overview**: hero + spec grid + schedule. Pull booked/kitty stats from DB.
7. **Crew**: list + realtime + open-slot placeholders.
8. **Shortlist**: vote rows, filters, realtime, ranking logic.
9. **Bookings**: CRUD + realtime + assignee select.
10. **Ledger**: stats + add expense + list + balances + realtime.
11. **Feed**: post + list + realtime.
12. **Polish**: loading states, empty states, error toasts, mobile checks.
13. **Deploy**: push to GitHub, connect Vercel, set env vars, verify prod.

## Conventions

- Server components by default. Client components only where interactivity is required (`'use client'` at top).
- Data fetching via Supabase server client in RSCs for initial load. Client realtime subscriptions layer on top for live updates.
- Mutations via server actions (`'use server'`) where possible. Validate inputs with Zod.
- Errors: log to console server-side, toast client-side via a simple toast component.
- Naming: `PascalCase` for components, `camelCase` for functions and variables, `kebab-case` for file names except component files which match the component name.
- No any types. If a type is unknown, use `unknown` and narrow.
- No comments explaining what code does. Comments only for why something non-obvious is done.
- Copy from the prototype verbatim. Do not rewrite section titles or lead paragraphs.

## Definition of done (MVP)

- All five tabs render correctly on desktop and mobile.
- Magic link auth works end-to-end on production.
- Two browsers signed in as different users see each other's votes, bookings, and expenses update live without refresh.
- Lighthouse performance score above 90 on the overview page.
- No console errors.
- Deployed to a public URL.

## Out of scope for MVP

- Direct image uploads (use pasted URLs for now).
- Push notifications.
- Multi-trip support (single hardcoded `stockholm-2026` trip).
- Admin panel.
- Custom activity creation by users (activities are seeded only).
- Receipt upload, per-item split, non-even split math.

## Reference files

- `prototype/stockholm_trip.html` — visual and structural reference
- `schema.sql` — initial database schema, RLS policies, and seed data
