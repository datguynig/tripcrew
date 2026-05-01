# Trustworthy Plan Links — Design

**Date:** 2026-05-02
**Status:** Draft, pre-implementation
**Spec ID:** B (one of four planned: A — Ledger v2, **B — Trustworthy plan links**, C — Trip extras, D — Feed Links view)

## Summary

Make every clickable place reference on a trip plan resolve to a real, verified destination, and surface live travel prices for Pioneers. Today the plan tells users "book ahead at SkyView" but offers no link, mentions "Vasa Museum" with hallucinated URLs the AI invented, and recommends "three neighbourhoods" all pointing to the same generic Booking.com search. After this spec, every named place becomes a verified `place_id` round-trip with valid Maps + website URLs, and Pioneers see live nightly hotel prices and live flight fare options for their trip dates.

## Why hotels feel broken today

The current Lock & Draft prompt explicitly forbids Gemini from picking specific hotels:

> Hotel suggestions must use the provided Booking.com search URL, not invented hotel names.

(See [src/lib/ai/prompts.ts:152](src/lib/ai/prompts.ts#L152).) The "hotel suggestions" rendered in the overview are actually neighbourhood descriptions: `{ area, description, searchUrl }`, where `searchUrl` is the same generic Booking.com search across all three. So the user expecting three hotel picks gets three neighbourhood cards, all linking to the same place, with no budget filter, no price, and no specific recommendations. This was a deliberate v1 conservatism — pre-spec we had no way to ground specific hotel picks. With SerpApi Google Hotels (key already provisioned) and the existing Places API plumbing, we can do this properly now.

A parallel problem affects schedule items, bookings, and activities: the AI emits prose with embedded URLs that are partially or fully hallucinated, and the schedule/booking schemas have no structured place fields at all. Day-by-day plan items render free text only; clicked links lead nowhere reliable.

## Scope

This spec covers two parallel workstreams:

1. **Place_id round-trip** for schedule items, bookings, and activities. Every named place gets a verified Google `place_id`, `maps_url`, and (where available) `website_url`. AI no longer emits inline URLs; they're resolved server-side at draft time and persisted on the row. Free for all tiers — strict improvement on today's behaviour.
2. **Live travel pricing** via SerpApi for flights and hotels. Pioneer-gated. Hotels become a real recommendation (3 specific picks ranked by Google Hotels, within budget where possible). Flights show 3 fare options with live prices. Member tier sees verified deeplinks (no live prices) — also a strict improvement on today.

## Out of scope (deferred)

- Price-drop notifications (`pricing_dropped` notification kind).
- Migration to a queryable `trip_pricing_snapshots` table (Approach B from architecture review). Designed for, not built.
- Auto-resolve `place_id` on user-typed booking additions (debounced lookup).
- Skyscanner / Kayak alternative deeplinks.
- Hotel rooms math integration with Spec C (room allocations) — wire up when Spec C lands.
- Multi-currency expense tracking (covered by Spec A — Ledger v2).

## Tier matrix

| Surface | Member | Pioneer |
|---|---|---|
| Schedule day "places mentioned" pills (verified) | ✓ | ✓ |
| Booking row Maps + Website icons | ✓ | ✓ |
| Activity card website link | ✓ | ✓ |
| 3 specific hotels w/ name, place_id, photo, deeplink | ✓ | ✓ |
| Live nightly hotel price in spec grid + sheet | — | ✓ |
| Flights cell — IATA-enforced Google Flights deeplink | ✓ | ✓ |
| Live flight price in spec grid + sheet | — | ✓ |
| 3 fare options sheet for flights | — | ✓ |
| Refresh prices (30-min per-trip rate limit) | — | ✓ |

Member tier gets *real* hotels (where today they get neighbourhoods all pointing to one search). Pioneer's differentiator is live current prices and the refresh loop. The volatile, network-expensive parts gate at Pioneer.

## Section 1 — Data model

### Place_id round-trip (free for all tiers)

**Activities** (existing): `website_url` already stored from the Phase 4 media backfill but not surfaced in the card UI today. Add two columns:

```sql
alter table activities
  add column place_id text,
  add column maps_url text;
```

`website_url` already exists.

**Bookings** (new columns):

```sql
alter table bookings
  add column place_id text,
  add column maps_url text,
  add column website_url text,
  add column custom_url text;
```

`custom_url` is an admin override. When set, takes precedence over `place_id`-derived URLs. Lets admins paste OpenTable / Resy / direct-vendor links the AI couldn't have known.

**Schedule items** (in `trips.meta.schedule` jsonb, no DDL change): extend `ScheduleItem`:

```ts
type ScheduleItem = {
  day_label: string;
  heading: string;
  body: string;            // prose, no inline URLs (regex-stripped before save)
  places: Array<{
    name: string;
    place_id: string | null;       // null if Places lookup missed
    maps_url: string | null;
    website_url: string | null;
  }>;                              // max 4
};
```

Body is link-free prose. A "Places mentioned" footer renders the resolved `places` as pills with valid links. Pills render only when `place_id !== null` — misses are invisible to the user.

### Pricing blob (Pioneer-only fetch; designed for future Approach B migration)

```ts
// Lives at trips.meta.pricing.
type TripPricing = {
  flight_quote: FlightQuote | null;
  hotel_quotes: HotelQuote[] | null; // max 3
  fetched_at: string | null;          // ISO
  refreshed_by: string | null;        // user_id
  source: "serpapi" | null;
  fetch_error: { code: string; message: string; partial?: boolean } | null;
};

type FlightQuote = {
  origin_iata: string;
  destination_iata: string;
  depart_date: string;
  return_date: string;
  adults: number;
  best_price: Money;
  options: FareOption[];   // 3 picks, sorted ascending by price
  fallback_deeplink: string;
};

type FareOption = {
  airline: string;
  airline_logo_url: string | null;
  price: Money;
  duration_minutes: number;
  stops: number;
  depart_iso: string;
  arrive_iso: string;
  deeplink: string;        // SerpApi-supplied direct booking URL
};

type HotelQuote = {
  name: string;
  place_id: string | null;
  rating: number | null;
  price_per_night: Money;
  total_price: Money;
  thumbnail_url: string | null;
  deeplink: string;
};

type Money = { amount: number; currency: string };
```

**Migration path to Approach B**: when we want price history (for `pricing_dropped` notifications), create `trip_pricing_snapshots` with these exact columns + `id`, `trip_id`, `fetched_at` PK. `trips.meta.pricing` becomes a denormalised "latest" view derivable from the table. No app reader changes.

## Section 2 — Lock & Draft pass changes

The Lock & Draft action ([src/lib/actions/lockAndDraft.ts](src/lib/actions/lockAndDraft.ts)) gains four steps. Place_id work runs for everyone; pricing work is Pioneer-gated.

### Step A — AI emits structured place names, no URLs, neighbourhoods only

Update [src/lib/ai/prompts.ts](src/lib/ai/prompts.ts):

- Per schedule day: emit prose `body` plus a short `places: [{ name }]` array (max 4, deduped, drawn from the supplied Places list).
- Per booking: emit `title` + an optional `place_name` (the venue to verify).
- Hotels: emit 3 **neighbourhoods** + descriptions. Do NOT emit specific hotel names.
- AI does NOT output URLs anywhere. Any URL in body is wrong by construction.

[src/lib/ai/schema.ts](src/lib/ai/schema.ts) Zod schemas extend to require `places: z.array(z.object({ name: z.string() })).max(4)` per schedule item, `place_name: z.string().optional()` per booking, and hotels become `whereToStay: [{ neighbourhood, description, bestFor }]` (no `hotelSuggestions` array — that comes from SerpApi now).

### Step B — Batched Places resolution for schedule + bookings + activities

After Gemini returns the structured plan, run one batched Places lookup:

```ts
// src/lib/places/resolveBatch.ts (new)
async function resolvePlaceNames(
  names: string[],
  destinationLatLng: { lat: number; lng: number },
  radiusMeters = 25_000,
): Promise<Map<string, ResolvedPlace>>;

type ResolvedPlace = {
  place_id: string;
  maps_url: string;
  website_url: string | null;
};
```

- One Places `searchText` per unique name, biased to destination coords.
- Hard cap: 25 lookups per draft.
- Per-name dedupe: same name across days → one call.
- Distance sanity check: result coords must be within 50 km of destination centroid; otherwise dropped (catches homonyms).
- URL validation on result: `website_url` must parse as `http(s)`; otherwise nulled.
- Misses → name-only entry in `places`, no link rendered.

Persist:
- Schedule items: write into `trips.meta.schedule[i].places[j]`.
- Bookings: write `place_id`, `maps_url`, `website_url` directly on the row.
- Activities: extend the existing activity-write path that already handles `website_url`.

### Step C — Hotel picks via SerpApi Google Hotels (all tiers, one call per draft)

```ts
// src/lib/travel/serpapi.ts (new)
async function fetchHotelQuotes({
  destination,
  checkIn,
  checkOut,
  rooms,
  perRoomBudget,
}): Promise<SerpApiResult<HotelQuote[]>>;
```

- Single call: `engine=google_hotels`, sort by rating, max 3 results.
- Rooms math: `rooms = Math.max(1, Math.ceil(target_crew_size / 2))`.
- Budget hint: `perRoomBudget = target_budget_pp * 0.4 / trip_days * 2`, passed as `max_price` filter where SerpApi supports it. Tunable constants live in the module.
- Always run this call regardless of tier — the 3 picks (names + place_ids + photos) are visible to everyone. Pioneer additionally sees the `price_per_night` and `total_price` numbers in the UI; Member sees the names + deeplinks only.

If SerpApi fails or returns < 3 results, fall back to a degraded path: ask Gemini for 3 specific hotel names from the Places-supplied hotel list (the original spec design), resolve via `resolvePlaceNames`. Fallback path activates without user-visible error — only the prices go missing.

### Step D — Flight quote via SerpApi Google Flights (Pioneer only)

Only if `hasProAccessForTrip(user, trip)`:

```ts
async function fetchFlightQuote({
  originIata,
  destIata,
  departDate,
  returnDate,
  adults,
}): Promise<SerpApiResult<FlightQuote>>;
```

- Single call: `engine=google_flights`, return top 3 fares sorted ascending by price.
- Adults = `target_crew_size`.
- IATA codes resolved at trip-lock time (we already capture origin metro IATA via `formatOriginShort`; destination IATA via the locked candidate's airport metadata). Missing IATA → `missing_input` error code → deeplink fallback.

If SerpApi fails, deeplink fallback (the existing `buildGoogleFlightsUrl` URL) — same as Member's view.

### Step E — Persist + telemetry

- Plan + place data writes commit FIRST.
- Pricing fetch runs in the same `after()` callback. Failures cannot poison the plan.
- Telemetry: every SerpApi call writes an `ai_usage` row (`kind: "serpapi_flight" | "serpapi_hotel"`, with `error_code` if applicable). `/ai-usage` learns to track SerpApi spend alongside Gemini + Places.
- `meta.draft_progress` extended with two soft-warning states: `places_partial` (some Places resolutions missed) and `pricing_failed` (SerpApi unhappy).

## Section 2.5 — Reliability & failure handling

The asymmetry that makes the spec shippable: place_id round-trip is **fail-safe** (worst case: pre-spec behaviour minus broken URLs). Live pricing is **fail-soft** (worst case: Member's deeplink view).

### Validation at every boundary

- Zod-strict schemas on every Gemini response. New fields (`places`, `place_name`, `whereToStay` shape) get explicit shape + length caps.
- URL regex strip on `body` before save: any `https?://...` token silently removed. Prompt drift becomes invisible.
- Place name sanitisation: trim, collapse whitespace, reject if `length < 2 || length > 80`.

### Place resolution graceful degradation

- **Pill renders only when `place_id !== null`.** Misses become plain text, never broken clicks. This is the single most important rule in the spec.
- Distance sanity check: 50 km radius from destination centroid.
- URL validation on resolved results: `http(s)` only.
- Hard cap of 25 Places lookups per draft.
- Per-name dedupe across days.

### SerpApi never throws, always degrades

Result envelope on every wrapper:

```ts
type SerpApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: SerpErrorCode; message: string };

type SerpErrorCode =
  | "timeout" | "rate_limit" | "parse_error"
  | "no_results" | "provider_error" | "missing_input" | "budget_cap";
```

- 10s timeout per call.
- Zod-validate response shape; drift → `parse_error` → deeplink fallback.
- All non-ok results write to `meta.pricing.fetch_error` and log to `ai_usage`.

### Pricing is non-blocking

Plan writes commit first. SerpApi runs in `after()`. UI: if `pricing === null && draft is fresh`, the cell shows `Pricing…` for max 60s, then falls back to deeplink.

### Idempotency + cost control

- Pricing fetch keyed by `(trip_id, depart_date, return_date, origin_iata, dest_iata, adults, rooms)`. Same key inside cache window → no SerpApi call.
- 30-min per-trip rate limit on the user-facing Refresh button, server-enforced via `meta.pricing.fetched_at` check.
- `SERPAPI_MONTHLY_CAP_USD` env var: once hit, all SerpApi calls return `budget_cap` and degrade to deeplinks. Bounded blast radius.

### Defence in depth on the Pioneer gate

`hasProAccessForTrip` checked server-side in every SerpApi-touching action. Client-side disabled state is cosmetic, not the gate.

### Telemetry + observability

- Structured server log per Lock & Draft completion: `{ tripId, places_resolved, places_missed, pricing: ok|failed|skipped, duration_ms }`.
- `meta.draft_progress` carries `places_partial` and `pricing_failed` flags as soft warnings.
- `/ai-usage` extended with SerpApi cost columns.

### Tests + feature-flagged rollout

- Unit tests on Zod schemas with synthetic adversarial inputs.
- Wrapper tests for SerpApi using recorded JSON fixtures (CI never hits real API).
- Playwright e2e: seeded test trip → Lock & Draft → assert `place_id` columns populated, schedule has `places` arrays, spec grid renders cleanly when pricing is null.
- Mocked-SerpApi-failure variant of the same e2e.
- `NEXT_PUBLIC_LIVE_PRICING_ENABLED` flag: place_id round-trip ships unflagged (strict improvement); SerpApi pricing ships flagged, default off, flipped on after staging soak.

### Manual QA gate

Before flipping the flag in prod:

- Lock & Draft on 3 destinations of different sizes (Stockholm, Lisbon, Marrakesh).
- Member view shows deeplinks; Pioneer view shows live prices.
- Refresh respects 30-min rate limit.
- Mobile layout doesn't break.
- Airplane-mode load doesn't crash.

## Section 3 — UI surfaces

### 3.1 Spec grid cells

The 4-cell spec grid extends to surface flight + stay summaries.

```
BASE      Stockholm                Sweden Summer 2026
FLIGHTS   From LHR  £242 return →  click → flights sheet
PER HEAD  £1,200pp                 Mid
STAY*     3 picks · £120/nt →      click → hotels sheet
```

`STAY*` replaces `THE RULE` only when `target_crew_size > 1` AND we have hotel data. Otherwise the cell stays as `THE RULE` (occasion + pinned moments). Spec grid never has a stale or empty cell.

Tier rendering:
- **Member** FLIGHTS: `Search flights →` (deeplink). Click → opens deeplink.
- **Pioneer** FLIGHTS: `from £242 return →` when pricing exists; `Search flights →` while pricing loads or fails. Click → opens sheet.
- **Member** STAY: `3 picks · See on Booking.com →`. Click → opens sheet (no prices, just names + deeplinks).
- **Pioneer** STAY: `3 picks · £120/nt →`. Click → opens sheet (with prices).

No tier badge on the cell itself. The price IS the visible upgrade.

### 3.2 Flights sheet (Pioneer only)

Modal dialog via existing `Dialog` primitive. Full-width on mobile, 540px max on desktop.

```
┌─ Flights to Stockholm ──────────────── Refresh ↻ ─┐
│  LHR · ARN · 12–17 Aug 2026 · 4 adults             │
│                                                     │
│  ✈ BA   £242  6h 45m · 0 stops · 09:25 → 12:10    │
│                                       Book →      │
│  ✈ SAS  £268  6h 30m · 0 stops · 12:10 → 14:40    │
│                                       Book →      │
│  ✈ BA   £312  9h 10m · 1 stop  · 06:00 → 16:30    │
│                                       Book →      │
│  + See more on Google Flights →                    │
│  Last updated 2 hours ago                          │
└────────────────────────────────────────────────────┘
```

- 3 fare options, sorted ascending by price.
- Each `Book →` opens the SerpApi-supplied direct booking deeplink.
- The `+ See more` footer always opens the Google Flights deeplink as an explicit escape hatch.
- Refresh ↻ states: `Refresh ↻` (idle) / `Refreshing…` (in-flight) / `Try in 18 min` (rate limited).

### 3.3 Stay sheet (all tiers)

Same dialog primitive. All tiers see this sheet; price columns hidden for Member.

```
┌─ 3 stays in Stockholm ────────────── Refresh ↻ ──┐
│  12–17 Aug 2026 · 2 rooms                          │
│                                                     │
│  [thumb] Hotel Diplomat        ★ 4.7               │
│          £120/nt · £600 total / room               │
│                                       See →       │
│  [thumb] Hotel At Six          ★ 4.5               │
│          £145/nt · £725 total / room               │
│                                       See →       │
│  [thumb] Miss Clara            ★ 4.4               │
│          £180/nt · £900 total / room               │
│                                       See →       │
│  + See more on Booking.com →                       │
└────────────────────────────────────────────────────┘
```

For Pioneer, prices are shown inline. For Member, the `£120/nt · £600 total` line is hidden and the `Refresh ↻` button is replaced by a small `Pioneer to see live prices →` link to `/account`. Hotel name remains clickable (Maps page); `See →` remains the deeplink.

If no hotels are within budget band, show 3 closest with a soft "Above budget" pill.

### 3.4 Schedule day items (overview)

Body becomes link-free prose. New "Places mentioned" footer renders pills only for resolved entries:

```
DAY 2 · A slow start in Söder
You wander Götgatan, settle in for fika at a café
that locals actually use, and let the afternoon
turn into Photographic Museum hours.

Places mentioned
[ Drop Coffee ↗ ]  [ Fotografiska ↗ ]
```

- Pill renders only when `place_id !== null`.
- Each pill links to `maps_url`. A small `↗` indicates external link.
- Optional secondary "website" sub-link if `website_url` exists and is non-Maps.

### 3.5 Bookings list

Each row gains up to two small icon buttons after the title:

```
☐  Book SkyView capsule         [📍] [🌐]    [Maël ▾]    ✕
☐  Book table at Frantzén       [📍]         [Unassigned ▾] ✕
```

- 📍 = Maps link. Always present if `place_id` resolved.
- 🌐 = Website. Present when `website_url` is non-null and different from `maps_url`.
- Admin-only `Edit URL` affordance in the row's overflow menu, writes to `bookings.custom_url`. When set, both icons collapse to a single primary `Book →` button.
- Mobile (< 520px): icons collapse into a single `Open ▾` menu so the row doesn't bust the grid.

### 3.6 Activity card

Activity cards already have a `website_url` field that wasn't surfaced. Add a small `Visit website ↗` link below the activity title — only renders when present. No layout shift when absent.

### 3.7 States — loading, error, empty, no-IATA

States are surface-specific because hotels and flights degrade differently.

**FLIGHTS cell (Pioneer only path; Member sees deeplink always):**
- Loading: sub-line shows `Pricing…` for max 60s. Timeout → silent fallback to deeplink CTA.
- Error (`fetch_error.flight !== null`): cell shows the IATA-enforced deeplink CTA. The flights sheet hides. A small red-amber dot tells admin "prices unavailable, click to refresh."
- Empty (no SerpApi response yet): same as loading.
- No origin IATA: cell renders `Add origin airport`, click goes to `/trips/[slug]/destinations`. Same as today.

**STAY cell (all tiers see hotels; only Pioneer sees prices):**
- Loading: sub-line shows `Pricing…` (Pioneer) or `3 picks · See on Booking.com →` (Member, since Member doesn't depend on prices).
- SerpApi succeeded, fallback path inactive: 3 ranked hotels with `place_id`, names, photos, deeplinks. Pioneer additionally sees prices.
- SerpApi failed, Gemini-fallback succeeded: same 3 hotels (Gemini-picked from Places list), no prices for either tier. Cell shows `3 picks · See on Booking.com →` for both tiers in this fallback case. A small soft warning toast surfaces on Pioneer's view: "Live prices unavailable for this trip."
- Both SerpApi AND fallback failed (rare): the STAY cell falls back to the original `THE RULE` content (occasion + pinned moments). No fake hotels. Logged as a `pricing_failed` warning in `meta.draft_progress`.

### 3.8 Refresh + freshness

The Refresh button (in the sheet) shows three states:
- Idle: `Refresh ↻`.
- In-flight: `Refreshing…` + spinner.
- Rate-limited: `Try in 18 min` (computed from `meta.pricing.fetched_at + 30 min`).

A `Last updated 2 hours ago` line below the rows builds trust.

### 3.9 Component layout

- New: `src/components/overview/FlightsSheet.tsx`, `src/components/overview/StaySheet.tsx`, `src/components/overview/PriceCellSummary.tsx`.
- Modified: `SpecGrid` (or wherever the grid renders), `BookingsList`, `ActivityCard`, the schedule renderer, `RefreshPricesButton`.
- All reuse existing primitives (`Dialog`, `Button`, `Badge`). Zero new UI primitives.

## Section 4 — Server actions

Two new files, three changed files. All `"use server"`.

### New: `src/lib/actions/pricing.ts`

```ts
export async function refreshTripPricing(tripId: string): Promise<{
  ok: true; pricing: TripPricing
} | {
  ok: false; reason: "rate_limited" | "not_pioneer" | "missing_iata" | "provider_error";
  retry_after?: string;
}>;
```

- Auth: `requireUser()`, `requireTripMember(tripId)`, `hasProAccessForTrip(user, trip)`. Three layers, fail-closed.
- Calls `fetchFlightQuote` + `fetchHotelQuotes` from `src/lib/travel/serpapi.ts`. Partial success allowed — flights work, hotels don't, returns `{ ok: true, pricing }` with one side null + `fetch_error.partial: true`.
- Writes `trips.meta.pricing` via service-role client.
- No notification fanout — pricing refresh is silent. (Future: `pricing_dropped` kind, when best price drops > 10%.)

### New: `src/lib/actions/bookingUrl.ts`

```ts
export async function setBookingCustomUrl(
  bookingId: string,
  url: string | null,
): Promise<{ ok: true } | { ok: false; error: string }>;
```

- Auth: `requireUser()`, `requireTripAdmin(trip_id)`.
- URL validation via `URL` constructor + `http(s)` allowlist. Max 2000 chars.
- Empty string treated as null (clear).

### Modified: `src/lib/actions/lockAndDraft.ts`

- Step 1 (Gemini draft): unchanged surface; Zod schemas updated per Section 2A.
- Step 2 (NEW — Places resolution): batched call via `resolvePlaceNames`.
- Step 3 (NEW — SerpApi Hotels): one call per draft for everyone; fallback to Gemini+Places hotels if SerpApi fails.
- Step 4 (existing — place-photo enrichment for activities): unchanged.
- Step 5 (NEW — SerpApi Flights): only if `hasProAccessForTrip`. Wrapped in try/catch with structured error log.
- Progress writes (`meta.draft_progress`): two new soft stages — `places` and `pricing`.

### Modified: `src/lib/actions/bookings.ts`

- `addBooking`: if Lock & Draft generated this row, place fields pre-populated. Manual additions skip Places resolution (out of scope for v1).

### Modified: `src/components/overview/RefreshPricesButton.tsx`

- Repurposed as the refresh trigger inside the new sheets.
- Wires to `refreshTripPricing`.
- Three-state UI per §3.8.

### Existing helpers reused

- `requireUser()`, `requireTripMember`, `requireTripAdmin` from existing `src/lib/supabase/server.ts` patterns.
- `hasProAccessForTrip(user, trip)` from `src/lib/plan.ts`.

## Section 5 — Rollout & launch checklist

### Phase 1 — Place_id round-trip (unflagged, ships first)

1. Schema migration: bookings + activities new columns.
2. Update Zod schemas + Gemini prompt to emit structured place names; remove inline-URL emissions; switch hotels to neighbourhoods-only output.
3. Implement `resolvePlaceNames` batch helper.
4. Wire into `lockAndDraft` Step 2.
5. UI: schedule pills, booking icons, activity website link.
6. Tests: Zod adversarial inputs, URL validation, distance check, Playwright e2e on real Lock & Draft.
7. Manual QA on 3 destinations: Stockholm, Lisbon, Marrakesh.

**Ship gate**: `pnpm build && pnpm test && pnpm tsc --noEmit` clean. Vercel preview smoke pass on all 3 destinations.

### Phase 2 — Live pricing (flag-gated, ships second)

8. Env vars: `SERPAPI_KEY`, `SERPAPI_MONTHLY_CAP_USD`, `NEXT_PUBLIC_LIVE_PRICING_ENABLED`.
9. Implement `src/lib/travel/serpapi.ts` with Zod + Result envelope + 10s timeout.
10. Implement `refreshTripPricing` action with three auth layers + rate limit.
11. Wire SerpApi Hotels into `lockAndDraft` Step 3 (all tiers).
12. Wire SerpApi Flights into `lockAndDraft` Step 5 (Pioneer-only).
13. UI: `FlightsSheet`, `StaySheet`, `PriceCellSummary`, refresh button states.
14. Tests: SerpApi wrapper with recorded fixtures, rate-limit unit test, Pioneer/Member rendering branches.
15. **Stage soak**: deploy to preview with flag on. Lock & Draft 3 trips. Watch `/ai-usage` for cost. Force a SerpApi failure to confirm fallback. Test mobile.
16. Flip `NEXT_PUBLIC_LIVE_PRICING_ENABLED=true` in production.

**Ship gate**: 24h soak in preview without errors. Cost telemetry sane (< $1/day on testing). SerpApi failure path manually tested.

## Open follow-ups

- `pricing_dropped` notification kind (depends on Approach B migration).
- Auto-resolve `place_id` on user-typed booking additions (debounced).
- Wire hotel rooms math to Spec C's room allocations once Spec C lands.
- Skyscanner/Kayak alternative deeplinks if SerpApi degrades persistently.

## Critical files

- [src/lib/ai/prompts.ts](src/lib/ai/prompts.ts) — prompt rewrite (no inline URLs, neighbourhoods-only hotels, structured places)
- [src/lib/ai/schema.ts](src/lib/ai/schema.ts) — Zod schemas extended with `places`, removed `hotelSuggestions`
- [src/lib/actions/lockAndDraft.ts](src/lib/actions/lockAndDraft.ts) — five-step pipeline
- [src/lib/places/resolveBatch.ts](src/lib/places/resolveBatch.ts) — new
- [src/lib/travel/serpapi.ts](src/lib/travel/serpapi.ts) — new
- [src/lib/actions/pricing.ts](src/lib/actions/pricing.ts) — new
- [src/components/overview/FlightsSheet.tsx](src/components/overview/FlightsSheet.tsx) — new
- [src/components/overview/StaySheet.tsx](src/components/overview/StaySheet.tsx) — new
- [src/components/bookings/BookingsList.tsx](src/components/bookings/BookingsList.tsx) — icon row
- [src/lib/types.ts](src/lib/types.ts) — `ScheduleItem.places`, `TripPricing`, `FlightQuote`, `HotelQuote`, `FareOption`, `Money` types
