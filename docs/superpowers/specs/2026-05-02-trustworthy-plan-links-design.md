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

## Alignment with existing infrastructure

This spec **extends existing code paths**; it does not introduce parallel ones. The codebase already ships:

- `Plan = "free" | "trial" | "pro"` from [src/lib/plan.ts](src/lib/plan.ts) — `getUserPlan(userId)`, `hasProAccess(userId)`, `hasProAccessForTrip(userId, tripId)`. There is no `"member"` or `"pioneer"` plan value at the code level. **Member** and **Pioneer** are user-facing brand labels that both map to `pro`. **Pioneer** = `pro` AND `profiles.founding_crew_at IS NOT NULL`. The spec adds one new helper, `isPioneerForTrip(userId, tripId)`, used only to gate price *visibility* (not access).
- `LivePricing` type at [src/lib/types.ts:199](src/lib/types.ts#L199), persisted in `meta.live_pricing`. Currently flights-only (`{ low, high, currency, provider, refreshed_at, origin_iata, destination_iata }`). The spec **extends** this type rather than introducing `meta.pricing`.
- `refreshPrices(userId, tripId)` action at [src/lib/actions/priceRefresh.ts](src/lib/actions/priceRefresh.ts). The spec **extends** this single action (adds hotel fetching) rather than introducing `refreshTripPricing`.
- `canRefreshPrices(userId, tripId)` gate at [src/lib/gates.ts](src/lib/gates.ts) — already enforces `hasProAccessForTrip` + `REFRESH_RATE_LIMIT_HOURS = 4`. The spec **respects the existing 4h rate limit**; no new 30-min limit.
- `record_price_refresh` Postgres RPC writes `last_price_refresh_at` + `last_price_refresh_by` + the trial counter. The spec **continues using this RPC** when refreshes happen.
- `serpApiEnabled()` at [src/lib/serpapi/client.ts](src/lib/serpapi/client.ts) — the de-facto feature flag (env var presence). Plus `fetchFlightPrices(...)`. The spec **extends** the SerpApi client with `fetchHotelQuotes(...)` and evolves `fetchFlightPrices` to return structured options.
- `resolveOriginIata`, `resolveDestinationIata` at [src/lib/iata.ts](src/lib/iata.ts) — already used by `refreshPrices` for IATA validation. The spec uses these.
- `enriched_draft_tier: "basic" | "enriched"` on the `trips` table. **Free users get `basic` only** — no schedule, no bookings list, no spec grid populated. They see [BasicDraftView](src/components/overview/BasicDraftView.tsx) with an upgrade CTA. **The Spec B surfaces (place pills, booking icons, STAY cell, FLIGHTS cell summary, sheets) only render in the enriched tier.** Free users are silently out of scope for this spec — they upgrade first to see anything new.
- Auth helpers I previously named (`requireUser`, `requireTripMember`, `requireTripAdmin`) **do not exist**. The actual pattern is `const { data: { user } } = await supabase.auth.getUser()` + manual `user.id === userId` and admin-membership SQL checks. The spec uses the actual pattern.

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

Anchored to the actual code. **"Member" and "Pioneer" both have `Plan = "pro"`**; the difference is `profiles.founding_crew_at`. **"Free"** users only see the basic-tier draft and an upgrade gate; they're silently out of scope for everything in this matrix.

| Surface | Free | Member (pro, no `founding_crew_at`) | Pioneer (pro + `founding_crew_at`) |
|---|---|---|---|
| Sees enriched-tier draft surfaces at all | — | ✓ | ✓ |
| Schedule day "places mentioned" pills (verified) | — | ✓ | ✓ |
| Booking row Maps + Website icons | — | ✓ | ✓ |
| Activity card website link | — | ✓ | ✓ |
| 3 specific hotels w/ name, place_id, photo, deeplink | — | ✓ | ✓ |
| Live nightly hotel price in spec grid + sheet | — | — | ✓ |
| FLIGHTS cell — IATA-enforced Google Flights deeplink | — | ✓ | ✓ |
| Live flight price + 3 fare options in cell + sheet | — | — | ✓ |
| Refresh prices via existing 4h-rate-limited button | — | — | ✓ |

Member tier (today's status quo for paid users) gets a strict upgrade in real-hotel-name visibility — they currently see three neighbourhoods all pointing to one Booking.com search, after the spec they see three actual hotels. Pioneer's differentiator is **live price visibility + the refresh loop**, which is the volatile, network-expensive part of the system.

### One product/cost decision flagged here

Hotel SerpApi calls run for everyone in `pro` tier (Member + Pioneer) at Lock & Draft, because the 3 *names* are visible to both. That's an implicit cost commitment: **every Member draft burns one hotel SerpApi call (~$0.015)**. Two ways out if that's not desired:

1. **Accept the cost.** $0.015 × draft volume is negligible while we're pre-launch. (Recommended.)
2. **Member fallback path only.** Skip SerpApi for Member drafts; their hotel "picks" come from Gemini-pick-from-Places (the original spec's fallback). Pioneer keeps the SerpApi-primary path. Splits the code paths but zero per-Member-draft cost. Less consistent recommendation quality across tiers.

Option 1 is the spec's default. If you want option 2, say so before the implementation plan.

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

### Pricing blob — extended `LivePricing` (lives at `meta.live_pricing`, existing field)

The existing `LivePricing` type at [src/lib/types.ts:199](src/lib/types.ts#L199) is currently flights-only with low/high range. We **extend** it (no rename, no parallel field):

```ts
// trips.meta.live_pricing — extends the existing field, not a replacement.
export type LivePricing = {
  flights?: FlightPricing;       // existing optional, shape extended
  hotels?: HotelPricing;          // NEW
};

export type FlightPricing = {
  // EXISTING fields — readers continue to work
  low: number;
  high: number;
  currency: string;
  provider: "serpapi-google-flights";
  refreshed_at: string;
  origin_iata: string;
  destination_iata: string;
  // NEW fields for Spec B
  best_price?: Money;            // cheapest of `options`, mirrors `low` for backward compat
  options?: FareOption[];        // 3 picks, ascending by price; absent on degraded path
  fallback_deeplink?: string;
  fetch_error?: ErrorEnvelope | null;  // per-side error
};

export type HotelPricing = {
  quotes: HotelQuote[];          // max 3
  refreshed_at: string;
  provider: "serpapi-google-hotels";
  fetch_error: ErrorEnvelope | null;
};

export type FareOption = {
  airline: string;
  airline_logo_url: string | null;
  price: Money;
  duration_minutes: number;
  stops: number;
  depart_iso: string;
  arrive_iso: string;
  deeplink: string;
};

export type HotelQuote = {
  name: string;
  place_id: string | null;
  rating: number | null;
  price_per_night: Money;
  total_price: Money;
  thumbnail_url: string | null;
  deeplink: string;
};

export type ErrorEnvelope = {
  code: SerpErrorCode;
  message: string;
  occurred_at: string;
};

export type Money = { amount: number; currency: string };
```

**Backward compat**: existing readers ([EnrichedDraftView.tsx](src/components/overview/EnrichedDraftView.tsx) reads `livePricing?.flights?.low/high`) continue to work because the new fields are additive and `low/high` remain populated (mirrored from `best_price` and the priciest of `options`).

**Per-side errors**: separate `fetch_error` on `FlightPricing` and `HotelPricing` so partial success (one side works, the other doesn't) is explicit. UI branches on whichever side is populated.

**Migration path to a future `trip_pricing_snapshots` table**: append-only history of these same row shapes; `meta.live_pricing` becomes a denormalised "latest" view. No app reader changes when we cut over.

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

### Step C — Hotel picks via SerpApi Google Hotels (all `pro` tiers, one call per draft)

Add a new function in [src/lib/serpapi/client.ts](src/lib/serpapi/client.ts) (extending the existing client, not a parallel module):

```ts
// In the same file as fetchFlightPrices.
export async function fetchHotelQuotes(search: HotelSearch): Promise<HotelQuote[] | null>;
```

- Engine: `google_hotels`. Sort by rating. Max 3 results.
- Rooms math: `rooms = Math.max(1, Math.ceil(target_crew_size / 2))`.
- Budget hint: `perRoomBudget = target_budget_pp * 0.4 / trip_days * 2`, passed where SerpApi supports it. Tunable constants in the module.
- Runs for any `pro` user (Member + Pioneer). The 3 names + place_ids are part of the enriched draft for everyone; only Pioneer sees the prices in the UI.

If SerpApi returns null or < 3 results, fall back to a degraded path: ask Gemini for 3 specific hotel names from the Places-supplied hotel list, resolve via `resolvePlaceNames`. UI shows the same hotel cards but without prices (everyone, including Pioneer in this failure mode).

### Step D — Flight quote via SerpApi Google Flights (Pioneer only)

Skip the flight SerpApi call entirely for Member tier — the names aren't useful for flights (the deeplink is the value), and the prices are the Pioneer differentiator. Only run when `await isPioneerForTrip(user.id, tripId)` returns true.

Reuse the existing `fetchFlightPrices` from [src/lib/serpapi/client.ts](src/lib/serpapi/client.ts), evolved to additionally return structured `options[]`:

```ts
export type FlightPrices = {
  low: number;
  high: number;
  currency: string;
  sampleCount: number;
  // NEW
  options: FareOption[];        // 3 picks ascending by price
  best_price: Money;
};
```

The current implementation only returns low/high — extend it to also collect `airline`, `duration_minutes`, `stops`, `depart_iso`, `arrive_iso`, and `deeplink` for the top 3 fares. `low` keeps mirroring the cheapest `option.price` for backward compat.

IATA codes via existing `resolveOriginIata` / `resolveDestinationIata` from [src/lib/iata.ts](src/lib/iata.ts). Missing IATA → skip the call, log to `ai_usage` with `errorMessage: "missing_iata"`, surface deeplink fallback.

### Step E — Persist + telemetry

- Plan + place data writes commit FIRST.
- Pricing fetch runs in the same `after()` callback. Failures cannot poison the plan.
- Pricing writes go through `meta.live_pricing` via service-role client (matches existing `refreshPrices` pattern).
- Telemetry: every SerpApi call writes an `ai_usage` row using existing `logAiUsage` with `feature: "lock_and_draft_pricing_flights" | "lock_and_draft_pricing_hotels"` and `model: "serpapi"`. `/ai-usage` already groups by feature.
- Cost cap: before each call, sum `estimated_cost_gbp` from `ai_usage` for the current month where `feature like 'serpapi_%' or feature like 'lock_and_draft_pricing_%'`. If over `SERPAPI_MONTHLY_CAP_USD` (converted), short-circuit with `errorMessage: "monthly_budget_cap"` and surface deeplink fallback for that draft. Detail in §2.5.
- `meta.draft_progress` extended with two soft-warning states: `places_partial` (some Places resolutions missed) and `pricing_failed` (SerpApi unhappy on either side).

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
- All non-ok results write to `live_pricing.flights.fetch_error` or `live_pricing.hotels.fetch_error` (per side) and log to `ai_usage`.

### Pricing is non-blocking

Plan writes commit first. SerpApi runs in `after()`. UI: if `pricing === null && draft is fresh`, the cell shows `Pricing…` for max 60s, then falls back to deeplink.

### Idempotency + cost control

- Pricing fetch keyed by `(trip_id, depart_date, return_date, origin_iata, dest_iata, adults, rooms)`. Same key inside cache window → no SerpApi call.
- Existing 4h per-trip rate limit (`REFRESH_RATE_LIMIT_HOURS`) on the user-facing Refresh button, server-enforced via `canRefreshPrices` gate which reads `trips.last_price_refresh_at`.
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
- Feature flag: existing `serpApiEnabled()` (env var presence). Place_id round-trip ships unflagged (strict improvement, no SerpApi dependency). Hotel + flight pricing extension is implicitly gated by `serpApiEnabled()` — when SERPAPI_KEY is unset the new code paths are no-ops and the UI shows the pre-Spec-B behaviour. Staging soak happens by setting SERPAPI_KEY in preview but leaving it unset in prod until ready.

### Manual QA gate

Before flipping the flag in prod:

- Lock & Draft on 3 destinations of different sizes (Stockholm, Lisbon, Marrakesh).
- Member view shows deeplinks; Pioneer view shows live prices.
- Refresh respects existing 4h rate limit (`REFRESH_RATE_LIMIT_HOURS`).
- Mobile layout doesn't break.
- Airplane-mode load doesn't crash.

### Explicit failure-handling items

The five concerns flagged in spec review:

1. **Per-side error envelopes.** `LivePricing.flights.fetch_error` and `LivePricing.hotels.fetch_error` are independent. Partial success (flights succeeded, hotels failed) writes both, UI branches per side. No single top-level `fetch_error` that obscures which side broke.

2. **Stale background pricing — UI must settle without phantom load.** If `after()` is killed mid-flight (serverless invocation reaped) and never writes `live_pricing`, the UI cannot wait forever. Rule: `EnrichedDraftView` checks `(Date.now() - Date.parse(enrichedDraftGeneratedAt)) > 60_000 && live_pricing == null` → render fallback deeplink CTAs and stop showing `Pricing…` placeholders. Implemented client-side; no extra server call. Belt-and-braces: when Lock & Draft writes the plan, it also writes `meta.live_pricing = { flights: undefined, hotels: undefined }` (empty object, not undefined) so the realtime subscription has *something* to react to even if the after() callback never fires.

3. **Cost cap enforcement — where it's read from, race-safety.** Monthly spend lives in `ai_usage` (existing telemetry table). The pre-flight check is a single SQL aggregate: `select coalesce(sum(estimated_cost_gbp), 0) from ai_usage where created_at >= date_trunc('month', now()) and (feature like 'serpapi_%' or feature like 'lock_and_draft_pricing_%')`. Compared against `SERPAPI_MONTHLY_CAP_GBP` env var. **Race-safety**: not atomic — two concurrent drafts can both read "under cap" and both proceed. Acceptable because the cap is soft (overshoot by 1–3 calls × $0.015 = noise) and adding an advisory lock would slow happy-path drafts. The query runs at the start of every SerpApi call, not just refresh — so even pathological loops self-throttle.

4. **Places quota / rate-limit behaviour — never blocks draft save.** `resolvePlaceNames(...)` is wrapped in its own try/catch in [lockAndDraft.ts](src/lib/actions/lockAndDraft.ts). On any failure (Places quota exhaustion, network error, rate limit, parse error), we log to `ai_usage` with `errorMessage: "places_resolution_failed"` and proceed with empty `places: []` arrays on schedule items + null `place_id` on bookings. The plan still saves. Pills don't render (per the §2.5 rule). The user sees the existing pre-Spec-B behaviour for that one draft.

5. **Existing manual edits must survive regeneration.** When a user re-runs Lock & Draft on a trip with existing `bookings` rows, the action follows this policy:
   - **Delete only `ai_drafted = true` rows.** Manually-added bookings (where `ai_drafted = false`) are preserved as-is.
   - **For AI-drafted rows**, before deleting, snapshot a `Map<title, { custom_url, assignee_id, done }>` keyed by lower-cased title. After re-emitting the new AI bookings, look up matching titles in the snapshot and merge: `custom_url` always preserved if non-null; `assignee_id` and `done` preserved when the new row's title fuzzy-matches (Levenshtein distance ≤ 2 over the lowercase normalized form). Mismatched titles get a fresh row.
   - **Same policy for `activities`** (already has `ai_drafted` column). Manually-added activities never deleted; AI-drafted activities preserve user-set vote state via the existing `votes` table (votes are FK'd to activity_id, so deleting + recreating activities loses votes — fix: do the title-fuzzy-match lookup before delete and update-in-place rather than delete-and-recreate where possible).
   - **Schedule items** live in `meta.schedule` jsonb. Always replaced wholesale on regenerate (no per-item user state to preserve today). Custom URLs there don't exist as a feature.

   This is an additive policy on top of the current "delete-and-recreate" used by Lock & Draft. Worth explicit unit tests.

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
- Rate-limited: `Try in 2h 18m` (computed from `trips.last_price_refresh_at + 4 h`).

A `Last updated 2 hours ago` line below the rows builds trust.

### 3.9 Component layout

- New: `src/components/overview/FlightsSheet.tsx`, `src/components/overview/StaySheet.tsx`, `src/components/overview/PriceCellSummary.tsx`.
- Modified: `SpecGrid` (or wherever the grid renders), `BookingsList`, `ActivityCard`, the schedule renderer, `RefreshPricesButton`.
- All reuse existing primitives (`Dialog`, `Button`, `Badge`). Zero new UI primitives.

## Section 4 — Server actions

**Extends existing actions.** No parallel pricing action.

### Extended: [src/lib/actions/priceRefresh.ts](src/lib/actions/priceRefresh.ts) (existing — adds hotels)

The existing `refreshPrices(userId, tripId)` action already handles auth (`canRefreshPrices` gate), IATA resolution, SerpApi flight call, and persists `meta.live_pricing`. We extend it:

```ts
export async function refreshPrices(
  userId: string,
  tripId: string,
): Promise<PriceRefreshResult>;
// Existing return shape unchanged. New behaviour:
// - Calls fetchFlightPrices (already does)
// - Calls fetchHotelQuotes (NEW)
// - Persists both into meta.live_pricing.flights + .hotels
// - Per-side error envelopes — partial success allowed
```

- Auth pattern unchanged: existing `await supabase.auth.getUser()` + `userId === user.id` check + `canRefreshPrices` gate. **No fictional `requireUser`.**
- Existing 4h rate limit via `REFRESH_RATE_LIMIT_HOURS` honoured.
- Existing `record_price_refresh` Postgres RPC continues writing `last_price_refresh_at` / `last_price_refresh_by` / trial counter.
- Both SerpApi calls run in parallel (`Promise.allSettled`); whichever succeed populate their side, whichever fail write `fetch_error` on their side.
- Cost-cap pre-flight check (per §2.5 item 3) runs once before the parallel block.

### New: `src/lib/actions/bookingUrl.ts`

```ts
export async function setBookingCustomUrl(
  bookingId: string,
  url: string | null,
): Promise<{ success: true } | { success: false; error: string }>;
```

- Auth: existing pattern — `await supabase.auth.getUser()` then SQL membership check:
  ```ts
  const { data: row } = await supabase
    .from("bookings")
    .select("trip_id, trip_members!inner(role, user_id)")
    .eq("id", bookingId)
    .eq("trip_members.user_id", user.id)
    .eq("trip_members.role", "admin")
    .maybeSingle();
  if (!row) return { success: false, error: "Not authorised." };
  ```
- URL validation: `new URL(url)` + protocol must be `http:` or `https:`. Max 2000 chars. Empty string treated as null (clears the override).

### New helper: `src/lib/plan.ts` — `isPioneerForTrip`

```ts
// Returns true if any trip admin has profiles.founding_crew_at IS NOT NULL.
// Mirrors hasProAccessForTrip's "any-admin-pays" semantics.
export async function isPioneerForTrip(userId: string, tripId: string): Promise<boolean>;
```

Used at UI render time and inside Step D of Lock & Draft to gate the flight SerpApi call.

### Modified: [src/lib/actions/lockAndDraft.ts](src/lib/actions/lockAndDraft.ts)

- Step 1 (Gemini draft): unchanged surface; Zod schemas updated per Section 2A.
- Step 2 (NEW — Places resolution): batched call via `resolvePlaceNames`. Wrapped in try/catch; failure → empty places, draft still saves (per §2.5 item 4).
- Step 3 (NEW — SerpApi Hotels): for any `pro` user (Member + Pioneer) one call per draft via `fetchHotelQuotes`. Fallback to Gemini+Places hotels if SerpApi fails.
- Step 4 (existing — place-photo enrichment for activities): unchanged.
- Step 5 (NEW — SerpApi Flights): only if `isPioneerForTrip`. Reuses `fetchFlightPrices` (extended to return `options[]`).
- **Regeneration policy** (per §2.5 item 5): pre-snapshot `(title → { custom_url, assignee_id, done })` for `ai_drafted = true` bookings, delete only those rows, re-insert with fuzzy-title-match merge of preserved fields. Same policy for activities.
- Progress writes (`meta.draft_progress`): two new soft stages — `places` and `pricing`.

### Modified: [src/lib/actions/bookings.ts](src/lib/actions/bookings.ts)

- `addBooking`: if called from inside Lock & Draft, place fields are pre-populated by the action. Manual additions (UI-typed) skip Places resolution and leave place fields null. Auto-resolve on a debounced lookup is deferred (out of scope for v1).

### Modified: [src/components/overview/RefreshPricesButton.tsx](src/components/overview/RefreshPricesButton.tsx)

- Already exists. Already wires to `refreshPrices`. After this spec it ALSO refreshes hotels (because `refreshPrices` is extended to do so). UI changes: button label updated to `Refresh prices`; three-state copy per §3.8 driven by existing `last_price_refresh_at` + `REFRESH_RATE_LIMIT_HOURS`.

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

### Phase 2 — Live pricing (gated by `serpApiEnabled()`, ships second)

8. Env vars: existing `SERPAPI_KEY` + new `SERPAPI_MONTHLY_CAP_GBP`. No new flag — `serpApiEnabled()` already returns true iff SERPAPI_KEY is set.
9. Extend [src/lib/serpapi/client.ts](src/lib/serpapi/client.ts): add `fetchHotelQuotes`, evolve `fetchFlightPrices` to also return `options[]` + `best_price`. Each wrapper preserves the existing null-on-failure return.
10. Add `isPioneerForTrip` helper to [src/lib/plan.ts](src/lib/plan.ts).
11. Extend [src/lib/actions/priceRefresh.ts](src/lib/actions/priceRefresh.ts): also call `fetchHotelQuotes`, persist both into `meta.live_pricing` with per-side error envelopes, run cost-cap pre-flight check.
12. Add `setBookingCustomUrl` action.
13. Wire SerpApi Hotels into `lockAndDraft` Step 3 (all `pro` tiers — flagged in tier matrix as a cost commitment).
14. Wire SerpApi Flights into `lockAndDraft` Step 5 (Pioneer-only via `isPioneerForTrip`).
15. UI: `FlightsSheet`, `StaySheet`, `PriceCellSummary`, refresh button states; UI 60s timeout for stale pricing per §2.5 item 2.
16. Tests: SerpApi wrapper with recorded fixtures, rate-limit unit test, Pioneer/Member/Free rendering branches, regeneration-preserves-manual-edits unit test, cost-cap unit test, places-failure-doesn't-block-save unit test.
17. **Stage soak**: deploy to preview with `SERPAPI_KEY` set, prod still without it. Lock & Draft 3 trips on preview. Watch `/ai-usage` for cost. Force a SerpApi failure to confirm fallback. Test mobile. Test airplane-mode (Lock & Draft with after() interrupted).
18. Set `SERPAPI_KEY` in production once preview soak passes.

**Ship gate**: 24h soak in preview without errors. Cost telemetry sane (< $1/day on testing). SerpApi failure path manually tested. Regeneration of an existing trip preserves a custom_url + assignee.

## Open follow-ups

- `pricing_dropped` notification kind (depends on Approach B migration).
- Auto-resolve `place_id` on user-typed booking additions (debounced).
- Wire hotel rooms math to Spec C's room allocations once Spec C lands.
- Skyscanner/Kayak alternative deeplinks if SerpApi degrades persistently.

## Critical files

- [src/lib/ai/prompts.ts](src/lib/ai/prompts.ts) — prompt rewrite (no inline URLs, neighbourhoods-only hotels, structured places)
- [src/lib/ai/schema.ts](src/lib/ai/schema.ts) — Zod schemas extended with `places`, removed `hotelSuggestions` from the AI's output (still used by EnrichedDraftView for backward compat during rollout)
- [src/lib/actions/lockAndDraft.ts](src/lib/actions/lockAndDraft.ts) — five-step pipeline + regeneration policy
- [src/lib/actions/priceRefresh.ts](src/lib/actions/priceRefresh.ts) — extended to also fetch hotels
- [src/lib/serpapi/client.ts](src/lib/serpapi/client.ts) — extended `fetchFlightPrices` + new `fetchHotelQuotes`
- [src/lib/plan.ts](src/lib/plan.ts) — new `isPioneerForTrip` helper
- [src/lib/places/resolveBatch.ts](src/lib/places/resolveBatch.ts) — new
- [src/lib/actions/bookingUrl.ts](src/lib/actions/bookingUrl.ts) — new
- [src/components/overview/FlightsSheet.tsx](src/components/overview/FlightsSheet.tsx) — new
- [src/components/overview/StaySheet.tsx](src/components/overview/StaySheet.tsx) — new
- [src/components/overview/EnrichedDraftView.tsx](src/components/overview/EnrichedDraftView.tsx) — extended to read new `live_pricing` fields + 60s phantom-load timeout
- [src/components/bookings/BookingsList.tsx](src/components/bookings/BookingsList.tsx) — icon row + admin URL override
- [src/lib/types.ts](src/lib/types.ts) — `ScheduleItem.places`, extended `LivePricing`, new `FlightPricing`, `HotelPricing`, `FareOption`, `HotelQuote`, `ErrorEnvelope`, `Money`
