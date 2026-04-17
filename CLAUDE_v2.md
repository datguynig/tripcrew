# Tripcrew — v2 Build Brief

## Purpose

v1 shipped a working single-trip app hardcoded to Stockholm. v2 turns it into Tripcrew the product: dynamic trip metadata, an admin surface, invite links (with optional email delivery via Resend), a multi-trip switcher, a full accessibility pass, a design-system primitives layer, and a Mapbox-powered destination search on the trip setup form.

This brief supersedes `CLAUDE.md` for anything it touches. `CLAUDE.md` remains authoritative for v1 concepts (tech stack, conventions, project structure, realtime patterns). The prototype at `prototype/stockholm_trip.html` remains the canonical visual reference; Stockholm is one instance of the grammar, not the grammar itself.

## Phase order

Ten phases. Letters are non-contiguous on purpose, so the accessibility pass sits where it's needed without colliding with earlier planning notation.

```
F → G → K-a11y → H → I → J → L → M → N → P
```

- **F** — Dynamic trip metadata
- **G** — Admin settings page (introduces Button, Field, Dialog, Toast primitives)
- **K-a11y** — Accessibility floor
- **H** — Invite links and people directory (Resend for optional email)
- **I** — Top-bar trip switcher
- **J** — Rebrand and generic copy
- **L** — Badge primitive and remaining audit
- **M** — Contrast and layout consistency sweep
- **N** — Mapbox destination search
- **P** — Polish, empty states, verify

Reasoning for this order:
1. Dynamic metadata (F) must land before the rebrand (J) so the rebrand has a data model to read from.
2. Admin (G) introduces primitives because destructive admin actions need Dialog and Toast immediately. Pulling those forward means L is a smaller audit phase rather than a ground-up build.
3. Accessibility floor (K-a11y) sits before invites (H) so new invite UI inherits focus-visible rings and labelled inputs from the start.
4. Rebrand (J) sits after primitives are introduced but before the Badge primitive (L) so generic copy lands once, not twice.
5. Mapbox (N) sits near the end because the admin trip-create form is the first place the picker is needed, and by then the Field, Button, and Toast primitives are stable.

## Pause points

Four places where Claude Code must stop and wait for owner confirmation before applying changes. These are operations that cannot be cleanly undone with `git reset`.

1. **Before F1** — first `meta` migration on `trips`.
2. **Before G1** — `owner_id` migration on `trips`.
3. **Before H1** — new `trip_invites` table and RLS policies.
4. **Before H2** — confirm `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set in `.env.local`. If either is missing, stop and ask.
5. **Before H4** — show me the rendered invite email HTML before the first test send.
6. **Before I1** — middleware change affecting session handling.
7. **Before N1** — `trips` table gets city, country, coords, timezone columns.

At each migration pause point, print the SQL about to run, the migration filename, and wait.

---

## Phase F — Dynamic trip metadata

### Goal

Every piece of Stockholm-specific copy currently in `src/constants/trip.ts` and hardcoded in `src/components/layout/Hero.tsx` becomes data on the trip row, read at request time. `constants/trip.ts` shrinks to cross-trip defaults only.

### Schema

New migration file `supabase/migrations/<timestamp>_trip_meta.sql`:

```sql
alter table trips
  add column hero_title text,
  add column hero_subtitle text,
  add column city_label text,
  add column dates_label text,
  add column target_budget_pp numeric(10, 2),
  add column meta jsonb not null default '{}'::jsonb;

-- Seed existing Stockholm trip
update trips
set
  hero_title = 'Stockholm',
  hero_subtitle = 'Three nights. Five of us. One city built on fourteen islands. Base camp on Södermalm, days on the water, nights that go somewhere. Book early, drink smarter, show up.',
  city_label = 'Stockholm, SE',
  dates_label = '23 – 26 Jul 26',
  target_budget_pp = 950,
  meta = jsonb_build_object(
    'spec', jsonb_build_array(
      jsonb_build_object('label', 'Base', 'value', '3-bed Airbnb', 'sub', 'Södermalm, SoFo area'),
      jsonb_build_object('label', 'Flights', 'value', 'LHR → ARN', 'sub', 'SAS or BA direct · 2h 20m'),
      jsonb_build_object('label', 'Per head', 'value', '£950', 'sub', 'Everything in, ex. flights'),
      jsonb_build_object('label', 'The rule', 'value', 'Systembolaget by Fri 3pm', 'sub', 'State off-licence, closes early')
    ),
    'schedule', jsonb_build_array(
      jsonb_build_object('day', 'THU / 23', 'head', 'Land, settle, starters', 'body', 'Lunch at Urban Deli. Sunset at Monteliusvägen. Rooftop at Takparken. Meatballs for the People. Light first night at Häktet.'),
      jsonb_build_object('day', 'FRI / 24', 'head', 'Water by day. Trädgården by night.', 'body', 'Kayak the inner archipelago. Swim off Skinnarviksberget. Pelikan for Swedish classics. Tjoget for cocktails. Trädgården until three.'),
      jsonb_build_object('day', 'SAT / 25', 'head', 'Culture, dress code, big one.', 'body', 'Vasa Museum, then Gröna Lund for rides and a concert. Dinner at Kagges. Pharmarium in Gamla Stan. Berns late.'),
      jsonb_build_object('day', 'SUN / 26', 'head', 'Recover, fly home.', 'body', 'Rooftop brunch at Fotografiska. Arlanda Express to the airport.')
    ),
    'section_leads', jsonb_build_object(
      'overview', 'Södermalm apartment. Archipelago days. Trädgården nights. Low-key Thursday, water Friday, dressed-up Saturday, brunch Sunday.',
      'shortlist', 'Vote yes, meh, or no. Ranked by consensus. Stuff the crew wants floats up. Tap twice to clear.',
      'bookings', 'The checklist. Claim one, book it, tick it. Simple accountability.',
      'ledger', 'Pool everything, split even. Log what you pay, balances update. Settle on the flight home.',
      'feed', 'Photos and dispatches from the trip. Paste an image URL, add a line, post. Build the record as you go.'
    )
  )
where slug = 'stockholm-2026';
```

### Code changes

- Extend `Trip` type in `src/lib/types.ts` to include the new fields and a typed `TripMeta` interface for the JSONB shape.
- Update `getTrip()` in `src/lib/auth.ts` to select the new columns.
- Rewrite `src/app/(app)/page.tsx` to read spec, schedule, and section_leads from `trip.meta` rather than the `SPEC`, `SCHEDULE`, `SECTION_LEADS` constants.
- Rewrite `src/components/layout/Hero.tsx` to accept `heroTitle`, `heroSubtitle`, `cityLabel`, `datesLabel` as props and compute T-Minus from `trip.start_date` rather than a constant.
- Every `(app)/*/page.tsx` that imports `SECTION_LEADS` now passes `trip.meta.section_leads[key]` to `SectionHeader`.
- Delete the `SPEC`, `SCHEDULE`, `HERO_SUB`, `SECTION_LEADS`, `TARGET_BUDGET_PP`, `TRIP_START`, `TRIP_END` exports from `src/constants/trip.ts`. Keep only `TARGET_CREW` as a fallback default for new trips.

### Sub-commits

1. **F1** — migration file + type update. Pause here.
2. **F2** — rewire Hero and overview page to read from DB.
3. **F3** — rewire section leads across all five tabs.
4. **F4** — remove dead constants, verify nothing imports them.

### Acceptance

- Overview page renders identical output to v1 (all copy matches), but every visible string comes from the DB.
- Changing `hero_title` in the database and refreshing updates the page.
- `grep -r "SPEC\|SCHEDULE\|HERO_SUB\|SECTION_LEADS" src/` returns nothing.

---

## Phase G — Admin settings page

### Goal

A `/admin` route where the trip owner can edit all the metadata F just introduced, plus target crew size and dates. Only the owner sees it. This phase is also where the core UI primitives are introduced, because admin actions need Dialog for irreversible operations, Toast for confirmations, Field for labelled inputs, and Button for consistent CTAs.

### Schema

New migration `<timestamp>_trip_owner.sql`:

```sql
alter table trips
  add column owner_id uuid references profiles(id) on delete set null;

-- Seed: current first member of Stockholm trip becomes owner
update trips t
set owner_id = (
  select user_id from trip_members
  where trip_id = t.id
  order by joined_at asc
  limit 1
)
where slug = 'stockholm-2026';

-- Owner update policy
create policy "trips_update_owner" on trips
  for update to authenticated
  using (owner_id = auth.uid());
```

### Primitives introduced in this phase

Install shadcn components and Sonner: `pnpm dlx shadcn@latest add dialog` and `pnpm add sonner`.

All primitives live in `src/components/ui/`.

**`<Button>`** — variants `primary | secondary | ghost | destructive | icon`, tone `default | accent`, sizes `sm | md | lg`. Every variant has `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg` baked in. Primary is `bg-fg text-bg hover:bg-accent`. Accent tone uses `bg-accent` as default state.

**`<Field>`** — props `{ label, name, helper?, error?, hideLabel?, children }`. Wires `htmlFor`, `aria-describedby`, `aria-invalid` automatically. `hideLabel` makes the label `sr-only` but keeps it associated for screen readers.

**`<Dialog>`** — shadcn `dialog` restyled: `bg-bg-2`, `border border-line-2`, `rounded-md`, no heavy overlay. Use only for irreversible actions.

**`<Toast>` + `useToast()`** — Sonner wrapper. Configure `<Toaster theme="dark" position="bottom-center" />` in `src/app/layout.tsx`. Export a hook with an `undo()` helper:

```ts
toast.undo({
  message: 'Booking deleted',
  duration: 6000,
  onUndo: () => restoreBooking(id),
});
```

Implementation: optimistic local state removal, deferred server mutation by 5 seconds. If Undo is clicked, the mutation never fires. If not, it commits.

### Admin page

Route: `src/app/(app)/admin/page.tsx`. Server component. Redirect to `/` if `user.id !== trip.owner_id`.

Sections on the page:
- **Identity** — `hero_title`, `hero_subtitle`, `city_label`, `dates_label`. Uses `<Field>` + `<input>`. Save action commits to DB.
- **Dates and crew** — `start_date`, `end_date`, `target_crew_size`. Use native date inputs for now; the proper DatePicker primitive lands in Phase M.
- **Budget** — `target_budget_pp`. Numeric input.
- **Meta: Spec grid** — editable list of 4 spec cells. Add/remove/reorder.
- **Meta: Schedule** — editable list of schedule rows. Add/remove/reorder.
- **Meta: Section leads** — textarea per tab.
- **Danger zone** — "Archive this trip" button, wrapped in a `<Dialog>` confirmation because archiving is irreversible at this layer. (Actual archive column and logic out of scope for this phase; the button can be present and disabled with a "coming soon" helper until Phase P.)

All save actions are server actions with Zod validation. Each save shows a Toast on success.

### Sub-commits

1. **G1** — migration file. Pause here.
2. **G2** — install shadcn dialog + sonner. Configure Toaster in root layout.
3. **G3** — Button primitive + migrate existing CTAs on sign-in, profile, bookings, ledger, feed, not-found.
4. **G4** — Field primitive + migrate existing form inputs on sign-in, profile.
5. **G5** — Dialog primitive + useToast hook + undoable delete for bookings (proof of pattern).
6. **G6** — Admin route shell with owner gate.
7. **G7** — Admin sections wired end-to-end (identity, dates, budget).
8. **G8** — Admin meta editors (spec grid, schedule, section leads).

### Acceptance

- Visiting `/admin` as non-owner redirects to `/`.
- Every field saves without a page refresh (optimistic update + toast).
- Delete booking on the bookings page now shows an undo toast, and clicking Undo within 5 seconds restores the row without a server round-trip.
- All buttons across the app are the `<Button>` primitive, all inputs are wrapped in `<Field>`.

---

## Phase K-a11y — Accessibility floor

### Goal

Every remaining accessibility debt gets paid down in a single commit. Most of it was already solved by the Field primitive and the focus-visible classes baked into Button, so this phase is smaller than it would have been if it ran first.

### Changes

- **Focus rings.** Audit any interactive element that isn't using `<Button>` or `<Field>` yet: native selects, checkboxes (bookings), vote-bar buttons, filter pills, nav links, top-bar Switch button. Add `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg` to each.
- **Vote bar text alternative.** The distribution bar on shortlist rows currently has no screen-reader description. Add `role="img"` and `aria-label={`${c.yes} yes, ${c.maybe} maybe, ${c.no} no`}` computed from the counts.
- **Realtime list announcements.** Add `aria-live="polite"` and `aria-relevant="additions"` to the six list containers: crew, shortlist, bookings, ledger expenses, balances, feed posts.
- **Nav landmark.** The top-bar is a header, the nav is navigation. Add `<header>` around TopBar and `<nav aria-label="Sections">` around the nav links.
- **Vote buttons.** The YES/MEH/NO buttons are currently just text. Add `aria-pressed={mine === tone}` to each so screen readers announce the selected state.
- **Install axe in dev.** `pnpm add -D @axe-core/react` and wire it in `src/app/layout.tsx` dev-only via a tiny client component that calls `axe.run()` on mount.

### Sub-commits

1. **K1** — focus rings on the remaining native elements.
2. **K2** — aria-live, aria-label on vote bar, aria-pressed on vote buttons, landmarks.
3. **K3** — axe in dev, verify zero critical issues on every page.

### Acceptance

- Tab through every page from top to bottom: every stop has a visible ring.
- VoiceOver or NVDA announces new crew members, new posts, and new expenses without a page refresh.
- Running `@axe-core/react` against each route reports zero critical or serious issues.

---

## Phase H — Invites and people directory

### Goal

Trip owner can invite people via a shareable link (primary) or email (secondary). The primary path generates a token, surfaces a "Copy link" button, and the owner drops the link into WhatsApp or similar. The secondary path sends the same link via Resend for owners who prefer email. Either way, the invitee clicks the link, signs in, and is added to the trip automatically. A `/people` directory lists everyone the user has shared a trip with (foundation for cross-trip group memory later).

### Schema

New migration `<timestamp>_invites.sql`:

```sql
create table if not exists trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  email text not null check (length(email) between 3 and 200),
  token text unique not null default encode(gen_random_bytes(24), 'base64url'),
  invited_by uuid references profiles(id) on delete set null,
  accepted_by uuid references profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  unique (trip_id, email)
);

create index if not exists trip_invites_token_idx on trip_invites(token);
create index if not exists trip_invites_trip_id_idx on trip_invites(trip_id);

alter table trip_invites enable row level security;

create policy "invites_read_if_owner" on trip_invites
  for select to authenticated using (
    exists (select 1 from trips where id = trip_id and owner_id = auth.uid())
  );

create policy "invites_insert_if_owner" on trip_invites
  for insert to authenticated with check (
    exists (select 1 from trips where id = trip_id and owner_id = auth.uid())
  );

create policy "invites_delete_if_owner" on trip_invites
  for delete to authenticated using (
    exists (select 1 from trips where id = trip_id and owner_id = auth.uid())
  );

alter publication supabase_realtime add table trip_invites;
```

### Invite mechanism

Token-based, with two delivery paths for the owner to choose from.

**Primary: Copy link.** The admin invites UI shows a "Copy link" button next to each pending invite. Clicking it copies `https://<host>/invite/accept?token=<token>` to the clipboard and fires a success toast. The owner shares the link however they want (WhatsApp, iMessage, Signal, a DM). This is the recommended path for v2 because it works for any recipient, requires no email configuration, and matches where the crew already talks.

**Secondary: Email via Resend.** For owners who prefer email, a "Send email" button on each invite calls a server action that uses Resend to deliver a branded HTML email with the same accept link.

Env vars (add both to `.env.example` with empty values, and to `.env.local` with real ones):

```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev
```

Install: `pnpm add resend`.

Use `onboarding@resend.dev` as the from address for v2. This is Resend's shared test sender and requires no domain setup. Note that it only delivers to the email address registered on the Resend account, which is fine for v2 since the trip owner is also the primary tester. The UI should surface this limitation: when the owner clicks "Send email" and the recipient is not the Resend account owner, Resend's API returns an error; catch it, show a toast that says "Email delivery limited in v2. Use Copy link instead." Custom domain and unrestricted sender is deferred to v3.

The invite email lives in `src/lib/email/templates/invite.tsx` as a simple HTML template. Keep it minimal and on-brand: the Tripcrew wordmark, one line explaining who invited them to which trip, one CTA button, expiry reminder, short footer. Plain template string rendered via `resend.emails.send({ html: ... })`; no heavyweight email framework.

Do not use Supabase's `auth.admin.inviteUserByEmail()`. Resend gives control over copy, branding, and deliverability that Supabase's generic magic-link emails don't.

### Code changes

- `src/app/(app)/admin/invites/page.tsx` — owner-only section listing pending and accepted invites, with an add-invite form (email input via `<Field>`, submit via `<Button>`). Each pending row has two buttons: "Copy link" (primary) and "Send email" (secondary, ghost variant).
- `src/app/invite/accept/route.ts` — server route handler. Reads token from query, validates against `trip_invites`, looks up user, inserts into `trip_members`, marks invite accepted, redirects to `/`.
- `src/app/(app)/people/page.tsx` — directory of everyone on trips the current user is in. Just a list for now, no per-person detail pages.
- `src/lib/email/templates/invite.tsx` — HTML email template for Resend.
- `src/lib/email/send.ts` — thin wrapper around Resend's SDK. Export `sendInviteEmail({ to, inviterName, tripName, link })`. Handles the Resend API error gracefully and returns `{ ok: true } | { error: string }`.
- Nav is left untouched. The People directory lives under admin's sidebar, not in the main six-tab nav. The per-trip "Crew" tab still covers the per-trip roster.

### Sub-commits

1. **H1** — migration. Pause here.
2. **H2** — env vars, install Resend, email template file, `sendInviteEmail()` wrapper. Do not wire into UI yet.
3. **H3** — admin invites UI with "Copy link" as primary action. Uses `<Field>`, `<Button>`, `useToast`. Copy-link flow works end-to-end after this commit.
4. **H4** — "Send email" secondary action wired to `sendInviteEmail()`. Handle Resend's single-recipient error with a helpful toast. Before sending a first real test, show me the rendered email HTML for review.
5. **H5** — invite accept route + auto-add to `trip_members`.
6. **H6** — `/people` directory page.

### Acceptance

- Owner adds an email on the admin invites page. Clicking "Copy link" copies the accept URL to the clipboard and shows a confirmation toast.
- Pasting the link into a fresh browser (or incognito window), signing in, and landing on the trip overview adds the user to the crew roster.
- Clicking "Send email" on the same invite sends an email to the owner's own Resend-registered address; sending to any other address surfaces a useful error toast rather than failing silently.
- Revoking an unused invite deletes the row and hides it from the list.
- Expired invites (older than 14 days, unaccepted) show in the list with an "Expired" badge.

---

## Phase I — Top-bar trip switcher

### Goal

Replace the hardcoded `TRIP_SLUG = "stockholm-2026"` with a dynamic active-trip concept. The top bar shows the current trip name and a switcher dropdown listing every trip the user is a member of. Selecting a different trip swaps the whole app view.

### Mechanism

- Active trip stored as an HTTP-only cookie `tc_active_trip_slug`. Set on first request after sign-in to the user's most recently joined trip.
- Middleware reads the cookie, validates membership via Supabase, and attaches the trip to the request context. If the cookie is missing or invalid, middleware sets it to the user's most recent trip or redirects to a "You're not in any trips yet" page.
- `getTrip()` in `src/lib/auth.ts` changes signature: no arg, reads cookie, looks up by slug, returns the trip.
- `TRIP_SLUG` constant in `src/lib/types.ts` is deleted. Every server action that used it now gets the trip via `getTrip()` inside the action.

### Code changes

- `src/lib/supabase/middleware.ts` — add trip resolution logic after auth check. If no cookie and user has trips, set cookie to most recent. If cookie points to a trip the user isn't a member of (stale), reset to most recent.
- `src/lib/auth.ts` — `getTrip()` now reads the cookie via `next/headers`.
- `src/components/layout/TopBar.tsx` — replace "Boys Trip · 001" static label with `<TripSwitcher>` client component: shows current trip name, opens a dropdown of user's trips, clicking one sets the cookie and reloads.
- Every `src/app/(app)/*/actions.ts` file drops the `TRIP_SLUG` import and replaces `.eq("slug", TRIP_SLUG)` lookups with the result of an early `const trip = await getTrip()` call.

### Sub-commits

1. **I1** — middleware change + cookie setup. Pause here.
2. **I2** — refactor `getTrip()` and all server actions to drop `TRIP_SLUG`.
3. **I3** — `<TripSwitcher>` component in TopBar.
4. **I4** — "no trips yet" landing page for users without memberships.

### Acceptance

- A user who belongs to two trips sees both in the switcher and can swap between them.
- Swapping reloads the page with the new trip's data (hero, crew, shortlist, everything).
- A user with no trip memberships is shown a friendly landing page prompting them to accept an invite or (later) create a trip.

---

## Phase J — Rebrand

### Goal

Every Stockholm reference in static code dies. "Boys Trip · 001" becomes "Tripcrew". The sign-in, profile, 404, and app metadata all become product-level, not trip-level.

### Changes

**`package.json`** — rename `"name": "stockholm-trip"` to `"name": "tripcrew"`.

**`src/app/layout.tsx`** — metadata becomes:
```ts
export const metadata: Metadata = {
  title: "Tripcrew",
  description: "Plan group trips with your crew.",
};
```

**`src/app/(auth)/sign-in/page.tsx`** — rewrite the hero and copy:
- Tagline: `Tripcrew`
- Title: `Plan group trips<span className="text-accent">.</span><br />Together<span className="text-accent">.</span>`
- Subtitle: generic product copy about signing in to join or create trips.
- Remove all references to "Boys Trip", "Stockholm", "23 – 26 July 2026", "Three nights", "Five of us".

**`src/app/(auth)/profile/page.tsx`** — tagline becomes "One more thing" (already is). Copy is fine, generic enough.

**`src/app/not-found.tsx`** — tagline becomes `404 · OFF THE MAP`, title stays `Nothing here.`, body generic. Keep the radial-glow background, keep "Back to base" CTA but change "base" to "home" so it reads outside the trip metaphor.

**`src/components/layout/TopBar.tsx`** — brand label comes from the active trip via `<TripSwitcher>` (landed in Phase I). The static "Boys Trip · 001" string is deleted.

**`src/components/layout/Hero.tsx`** — already made dynamic in Phase F. No further change.

**`README.md`** — already generic. Expand slightly with a one-paragraph overview.

### Sub-commits

1. **J1** — metadata, package.json, README.
2. **J2** — sign-in rewrite.
3. **J3** — 404, profile.
4. **J4** — grep sweep: `grep -rE "Stockholm|Boys Trip|Three nights|Five of us" src/` returns zero results.

### Acceptance

- Opening the app incognito shows "Tripcrew" as the title tab, generic sign-in copy, no Stockholm references anywhere in the UI.
- The Stockholm trip itself still renders correctly because all Stockholm copy now lives in `trips.meta` (landed in Phase F).

---

## Phase L — Badge primitive and remaining audit

### Goal

The last primitive, plus an audit sweep to catch anything that didn't migrate cleanly in earlier phases.

### Badge primitive

`src/components/ui/Badge.tsx`:

```ts
type BadgeProps = {
  tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'err';
  variant?: 'solid' | 'soft' | 'outline';
  size?: 'sm' | 'md';
  children: React.ReactNode;
};
```

### Migrate to Badge

- `<span class="font-mono text-[10px] tracking-[0.15em] text-accent uppercase ml-2">You</span>` in CrewList → `<Badge tone="accent" size="sm">You</Badge>`.
- The status pill in the hero meta line (`STATUS / ACTIVE`) → `<Badge tone="accent" variant="soft">ACTIVE</Badge>`. Note the meta strip is mono-styled; the Badge should match.
- Filter pills in Shortlist → stay as buttons, not badges (they're interactive). Leave alone.
- Any future ADMIN, OWNER, INVITED, EXPIRED chips use Badge from the start.

### Audit

- `grep -rE "<span className=\"[^\"]*font-mono[^\"]*uppercase" src/` — every hit is a candidate for Badge migration. Review each, migrate where it's a status or role indicator, leave where it's a metadata label.
- `grep -r "<button className=\"bg-fg" src/` — should return zero hits (all migrated to Button in Phase G).
- `grep -r "<input type=" src/` — should only appear inside `<Field>`.

### Acceptance

- Every chip-shaped UI element is a `<Badge>`.
- Zero raw `<button className="bg-fg...">` in the codebase.
- Zero raw `<input>` outside Field or native-only cases (search, filter).

---

## Phase M — Contrast and layout consistency sweep

### Goal

Quiet, rigorous cleanup: contrast-safe text tones, standardised row padding, date pickers that match the aesthetic.

### Text tone mapping

`fg-3` (#6B6B70) fails WCAG AA for body text at ~3.7:1. Rule:
- `fg-3` is only for decorative, mono-cased metadata, or text ≤12px.
- Any sentence-length text, inactive nav labels, or muted-but-readable UI text moves to `fg-2` (#A8A8AD).

Audit: `grep -r "text-fg-3" src/`. For each hit, decide: is this a label, a date stamp, or real content? Labels and mono metadata stay. Content moves to `fg-2`.

Specific known targets:
- Inactive nav tabs in `src/components/layout/Nav.tsx` → `text-fg-2`.
- Hero meta strip labels (`LOC / `, `DATES / `) → stay `fg-3` (they're labels).
- Feed post captions currently use `text-fg` which is fine.

### Row padding

Standardise on two values:
- Dense rows (bookings, ledger entries, feed meta): `py-4 px-6`.
- Default rows (crew, shortlist, destinations): `py-5 px-6`.

Remove every `py-[14px]`, `py-[18px]`, `py-[22px]`, `py-[16px]` in the codebase.

### DatePicker primitive

`pnpm add react-day-picker`. Wrap in `src/components/ui/DatePicker.tsx` matching the palette: `bg-bg-2` calendar surface, `border border-line-2`, accent on selected day, fg-3 on other months. Use for admin date fields (start_date, end_date) that currently fall back to native inputs.

### Sub-commits

1. **M1** — contrast sweep. Run through every `text-fg-3` hit, migrate where needed.
2. **M2** — padding standardisation.
3. **M3** — DatePicker primitive + swap admin date fields.

### Acceptance

- Lighthouse accessibility score is 100 on every page.
- `grep -r "py-\[" src/` returns no bespoke row padding values.
- Admin date fields render in the dark palette, not browser-native.

---

## Phase N — Mapbox destination search

### Goal

Trip creation and editing in admin now includes a structured city search backed by Mapbox. Storing coordinates, timezone, and country unlocks future maps, timezone-aware deadlines, and weather hints without re-plumbing. No existing destinations feature to migrate; this is additive.

### Env

New var: `NEXT_PUBLIC_MAPBOX_TOKEN`. Add to `.env.example` with a comment pointing to `https://account.mapbox.com/access-tokens`. Token should be restricted to the Vercel deployment domain once in production.

### Schema

New migration `<timestamp>_trip_location.sql`:

```sql
alter table trips
  add column city_name text,
  add column country text,
  add column country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  add column latitude numeric(9, 6),
  add column longitude numeric(9, 6),
  add column mapbox_id text,
  add column place_type text,
  add column timezone text;
```

Existing `city_label` stays as a free-text display label (can be overridden by owner). The new fields are structured data for the future.

### Component

`src/components/ui/DestinationSearch.tsx`. Client component, wraps Mapbox's `@mapbox/search-js-react` `SearchBox`.

```ts
type DestinationResult = {
  title: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  mapboxId: string;
  placeType: string;
};

type Props = {
  onSelect: (result: DestinationResult) => void;
  initial?: string;
  placeholder?: string;
};
```

Installation: `pnpm add @mapbox/search-js-react`. Configure:
- `types="place,region,country,locality"` to filter out address-level noise.
- Dark theme override using the app's CSS custom properties (`--color-bg-2`, `--color-fg`, `--color-accent`).
- Keyboard navigation is built-in; test that Escape clears, Enter selects.

### Wiring

Admin identity section in `/admin` gets a DestinationSearch above the `city_label` field. Selecting a result:
- Writes structured fields (`city_name`, `country`, `country_code`, `latitude`, `longitude`, `mapbox_id`, `place_type`, `timezone`) to the trip.
- Auto-populates `city_label` as `${city_name}, ${country_code}` if the owner hasn't customised it.
- Timezone is looked up from the coordinates using `tzlookup` (`pnpm add @photostructure/tz-lookup`, runs server-side in the action).

### Sub-commits

1. **N1** — migration. Pause here.
2. **N2** — env var + package install + token restriction docs in README.
3. **N3** — `<DestinationSearch>` primitive.
4. **N4** — wire into admin identity section, handle auto-populate logic.

### Acceptance

- Opening admin and typing "sto" shows Stockholm as a suggestion within 500ms.
- Selecting it fills all eight structured columns without a page reload.
- The `city_label` shows "Stockholm, SE" unless the owner typed a custom label.
- Timezone is populated to `Europe/Stockholm`.

---

## Phase P — Polish, empty states, verify

### Goal

Final readiness pass. This is the original "Phase K: Polish + empty states + verify" from the prior plan, renamed to avoid collision.

### Changes

- **Empty states everywhere.** Every list page (crew with no members, shortlist before votes, bookings cleared, ledger clean, feed empty, people directory empty, admin invites none sent) gets a designed empty state, not just a "No items" mono stub. Use a shared `<EmptyState icon? title body action?>` primitive.
- **Loading states.** Each route already has a `loading.tsx` from v1; audit them and ensure the skeleton matches the final layout (hero shimmer on overview, row skeletons on lists).
- **Error boundaries.** Root-level `error.tsx` that renders a generic retry UI. Per-route error boundaries for the server-action-heavy pages (bookings, ledger).
- **Archive trip.** The "Danger zone" button from Phase G gets real logic here: soft-delete via an `archived_at` column on `trips`, hide archived trips from the switcher, allow restore from admin.
- **Verify.**
  - Lighthouse 95+ on every page.
  - `@axe-core/react` zero critical issues.
  - Two-browser realtime test still passes end-to-end.
  - Mobile manual walkthrough: top bar, nav, each tab, admin page.

### Sub-commits

1. **P1** — `<EmptyState>` primitive + audit all lists.
2. **P2** — error boundaries.
3. **P3** — archive trip logic (column, policy, UI toggle).
4. **P4** — verify pass. Document any leftover issues in a CHANGELOG entry.

### Acceptance

- Every empty list has a purpose-built empty state.
- Archiving a trip hides it from the switcher but preserves data.
- Zero console errors across every page in prod.

---

## Global conventions

All v1 conventions from `CLAUDE.md` still apply. Additions for v2:

- Every primitive lives in `src/components/ui/`. One file per primitive.
- Every server action validates with Zod. Every public server action returns `{ ok: true } | { error: string }`, never throws.
- Database migrations always include a descriptive name: `trip_meta`, `trip_owner`, `invites`, `trip_location`. Timestamp prefix from Supabase CLI.
- No em dashes anywhere in user-facing copy. Use commas, colons, or restructure the sentence.

## Out of scope for v2

Deferred to v3:
- Custom email domain for invite sender (currently `onboarding@resend.dev`, which only delivers to the Resend account owner's email). v3 will add domain verification and a branded `invites@<domain>` sender with unrestricted delivery.
- Map rendering of destinations (coordinates stored but not visualised).
- Timezone-aware deadlines using the stored `timezone`.
- Weather lookups per trip.
- Flight cost hints.
- OpenAI-powered itinerary generation or activity suggestions.
- Direct image uploads on the feed (still pasted URLs).
- Non-even expense splits, per-item split, receipts.
- Push notifications.
- Per-trip member roles beyond owner (co-admin, guest).
- Public trip links for non-members.

## Reference files

- `prototype/stockholm_trip.html` — visual grammar, unchanged
- `CLAUDE.md` — v1 brief, authoritative for anything not touched here
- `supabase/migrations/` — all new migrations land here
- `src/components/ui/` — primitives directory introduced in Phase G
