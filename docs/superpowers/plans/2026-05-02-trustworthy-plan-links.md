# Trustworthy Plan Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every clickable place reference on a trip plan resolve to a real, verified destination (place_id round-trip), and surface live travel prices for Pioneers (extended SerpApi flights + new hotel quotes).

**Architecture:** Two phases. Phase 1 ships unflagged because it's a strict improvement on existing behaviour: AI emits structured place names, server resolves them to verified place_ids/maps_urls, UI renders only successful resolutions. Phase 2 is gated by `serpApiEnabled()` (env var presence): extended `meta.live_pricing` with new hotel field, hotel SerpApi call for all `pro` users (Member + Pioneer), flight SerpApi call for Pioneer only, with per-side error envelopes and a 60s phantom-load UI ceiling.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase (Postgres + RLS), Zod, `@google/genai` (Gemini), Google Places New API, SerpApi Google Flights/Hotels, node:test for unit tests, Playwright for e2e.

---

## Pre-flight: Codebase orientation

Read these before starting:

- **Spec**: [docs/superpowers/specs/2026-05-02-trustworthy-plan-links-design.md](docs/superpowers/specs/2026-05-02-trustworthy-plan-links-design.md). Single source of truth for behaviour; this plan is the execution sequence.
- **Tier model**: `Plan = "free" | "trial" | "pro"` from [src/lib/plan.ts](src/lib/plan.ts). "Member" and "Pioneer" both have `pro`. Pioneer = `pro` AND `profiles.founding_crew_at IS NOT NULL`. Free users get `enriched_draft_tier === "basic"` and never see Spec B surfaces.
- **Existing pricing infra**: [src/lib/types.ts:199](src/lib/types.ts#L199) (`LivePricing`), [src/lib/serpapi/client.ts](src/lib/serpapi/client.ts) (`fetchFlightPrices`, `serpApiEnabled`), [src/lib/actions/priceRefresh.ts](src/lib/actions/priceRefresh.ts) (`refreshPrices`), [src/lib/gates.ts](src/lib/gates.ts) (`canRefreshPrices`, `REFRESH_RATE_LIMIT_HOURS = 4`), [src/lib/iata.ts](src/lib/iata.ts) (`resolveOriginIata`, `resolveDestinationIata`).
- **Existing Places infra**: [src/lib/places/text-search.ts](src/lib/places/text-search.ts) (`textSearch`), [src/lib/places/cache.ts](src/lib/places/cache.ts), [src/lib/places/types.ts](src/lib/places/types.ts) (`PlaceSummary`).
- **Auth pattern**: `await supabase.auth.getUser()` + manual user-id check + (where needed) SQL membership check. **No `requireUser`/`requireTripMember` helpers exist.**

### Test commands

- **Unit tests** (`node:test` via tsx): `pnpm exec tsx --test src/path/to/__tests__/file.test.ts`
- **Playwright e2e**: `pnpm test`
- **Type check**: `pnpm exec tsc --noEmit`
- **Build**: `pnpm build`

### File structure (locked here, referenced throughout)

**Phase 1 — new files:**
- `src/lib/places/resolveBatch.ts` — name → place_id batch resolver
- `src/lib/places/__tests__/resolveBatch.test.ts` — unit tests
- `supabase/migrations/20260502120000_spec_b_place_columns.sql` — DDL

**Phase 1 — modified files:**
- `src/lib/types.ts` — extend `ScheduleItem`, `Booking`, `Activity`
- `src/lib/ai/schema.ts` — extend Zod with `places`, drop `hotelSuggestions` from output
- `src/lib/ai/prompts.ts` — rewrite hotel + place instructions
- `src/lib/actions/lockAndDraft.ts` — Step 2 (places resolution) + regeneration policy
- `src/components/overview/EnrichedDraftView.tsx` — places pills, link-free body
- `src/components/bookings/BookingsList.tsx` — Maps + Website icons
- `src/components/shortlist/ShortlistBoard.tsx` — Visit website link on activity rows

**Phase 2 — new files:**
- `src/lib/serpapi/__tests__/client.test.ts` — wrapper unit tests
- `src/lib/actions/bookingUrl.ts` — admin custom_url action
- `src/lib/serpapi/costCap.ts` — monthly cap helper
- `src/components/overview/PriceCellSummary.tsx` — shared cell sub-line renderer
- `src/components/overview/FlightsSheet.tsx` — Pioneer flights sheet
- `src/components/overview/StaySheet.tsx` — pro tier stay sheet

**Phase 2 — modified files:**
- `src/lib/types.ts` — extend `LivePricing` with hotels + `FlightPricing`/`HotelPricing`/`FareOption`/`HotelQuote`/`ErrorEnvelope`/`Money`
- `src/lib/serpapi/client.ts` — extend `fetchFlightPrices` to return `options`, add `fetchHotelQuotes`
- `src/lib/plan.ts` — `isPioneerForTrip` helper
- `src/lib/actions/priceRefresh.ts` — also fetch hotels with per-side errors
- `src/lib/actions/lockAndDraft.ts` — Steps 3/5 (SerpApi calls) + empty live_pricing shell write
- `src/components/overview/RefreshPricesButton.tsx` — three-state UI
- `src/components/overview/EnrichedDraftView.tsx` — STAY cell, sheets, 60s timeout
- `src/components/bookings/BookingsList.tsx` — admin custom_url overflow menu
- `.env.example` — document `SERPAPI_KEY` and `SERPAPI_MONTHLY_CAP_GBP`

---

# Phase 1 — Place_id round-trip (ships unflagged)

## Task 1: DB migration + type extensions

**Files:**
- Create: `supabase/migrations/20260502120000_spec_b_place_columns.sql`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260502120000_spec_b_place_columns.sql`:

```sql
-- Spec B: structured place fields on bookings and activities so links
-- always resolve to verified Google Places destinations.

alter table bookings
  add column if not exists place_id text,
  add column if not exists maps_url text,
  add column if not exists website_url text,
  add column if not exists custom_url text;

alter table activities
  add column if not exists place_id text,
  add column if not exists maps_url text;

comment on column bookings.place_id is 'Google Places place_id, set at Lock & Draft time. Null for manual additions or unresolved AI suggestions.';
comment on column bookings.custom_url is 'Admin-only override; takes precedence over maps_url/website_url when set.';
comment on column activities.place_id is 'Google Places place_id, set during AI draft. Null for manual additions or unresolved.';
```

- [ ] **Step 2: Apply migration locally**

Run: `pnpm exec supabase db push` (or whatever the project uses; if unsure, run `pnpm exec supabase --help` to find the local-apply command).
Expected: clean apply, no errors. Confirm by running `psql $DATABASE_URL -c "\d bookings"` and seeing the new columns.

- [ ] **Step 3: Extend types in `src/lib/types.ts`**

Locate the existing `Booking` type. Replace it with:

```ts
export type Booking = {
  id: string;
  trip_id: string;
  title: string;
  assignee_id: string | null;
  done: boolean;
  position: number;
  ai_drafted: boolean;
  created_at: string;
  created_by: string | null;
  // Spec B
  place_id: string | null;
  maps_url: string | null;
  website_url: string | null;
  custom_url: string | null;
};
```

Locate the existing `Activity` type. Replace it with:

```ts
export type Activity = {
  id: string;
  trip_id: string;
  title: string;
  meta: string | null;
  category: "day" | "night";
  position: number;
  ai_drafted: boolean;
  photo_url: string | null;
  photo_attribution: string | null;
  rating: number | null;
  price_level: number | null;
  website_url: string | null;
  // Spec B
  place_id: string | null;
  maps_url: string | null;
  created_at: string;
};
```

Locate the existing `ScheduleItem` type and replace it with:

```ts
export type ScheduleItemPlace = {
  name: string;
  place_id: string | null;
  maps_url: string | null;
  website_url: string | null;
};

export type ScheduleItem = {
  day_label: string;
  heading: string;
  body: string;
  // Optional during the rollout window so existing rows without
  // `places` still render. Always written by Lock & Draft after
  // Phase 1 Task 5.
  places?: ScheduleItemPlace[];
};
```

- [ ] **Step 4: Verify type compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no errors related to Booking/Activity/ScheduleItem. (Other unrelated errors should not appear; if they do, they predate this task.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260502120000_spec_b_place_columns.sql src/lib/types.ts
git commit -m "feat(db): add place fields to bookings + activities for Spec B"
```

---

## Task 2: `resolvePlaceNames` batch helper

**Files:**
- Create: `src/lib/places/resolveBatch.ts`
- Test: `src/lib/places/__tests__/resolveBatch.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/places/__tests__/resolveBatch.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { resolvePlaceNames, type PlaceSearchFn } from "@/lib/places/resolveBatch";

const STOCKHOLM = { lat: 59.3293, lng: 18.0686 };

test("resolvePlaceNames dedupes case-insensitive duplicates", async () => {
  const calls: string[] = [];
  const search: PlaceSearchFn = async (query) => {
    calls.push(query);
    return [
      {
        id: "place_" + query.toLowerCase().replace(/\s+/g, "_"),
        location: { latitude: STOCKHOLM.lat, longitude: STOCKHOLM.lng },
        googleMapsUri: `https://www.google.com/maps/place/?q=place_id:place_${query}`,
        websiteUri: null,
      },
    ];
  };

  const result = await resolvePlaceNames(
    ["Vasa Museum", "vasa museum", "Fotografiska"],
    STOCKHOLM,
    25_000,
    { searchText: search, maxLookups: 25 },
  );

  assert.equal(calls.length, 2, "deduped to 2 unique queries");
  assert.ok(result.get("Vasa Museum"));
  assert.ok(result.get("Fotografiska"));
});

test("resolvePlaceNames drops results outside radius", async () => {
  const search: PlaceSearchFn = async () => [
    {
      id: "wrong_place",
      // Cambridge MA, ~5500km from Stockholm
      location: { latitude: 42.3736, longitude: -71.1097 },
      googleMapsUri: "https://www.google.com/maps/...",
      websiteUri: null,
    },
  ];

  const result = await resolvePlaceNames(
    ["Cambridge"],
    STOCKHOLM,
    50_000,
    { searchText: search, maxLookups: 25 },
  );

  assert.equal(result.size, 0, "out-of-radius result dropped");
});

test("resolvePlaceNames respects maxLookups cap", async () => {
  let callCount = 0;
  const search: PlaceSearchFn = async (q) => {
    callCount++;
    return [{ id: q, location: { latitude: STOCKHOLM.lat, longitude: STOCKHOLM.lng }, googleMapsUri: "", websiteUri: null }];
  };

  const names = Array.from({ length: 30 }, (_, i) => `Place${i}`);
  await resolvePlaceNames(names, STOCKHOLM, 25_000, { searchText: search, maxLookups: 5 });

  assert.equal(callCount, 5, "cap enforced");
});

test("resolvePlaceNames rejects names that fail validation", async () => {
  const search: PlaceSearchFn = async () => [];
  const result = await resolvePlaceNames(
    ["", "   ", "x", "a".repeat(81), "Valid Name"],
    STOCKHOLM,
    25_000,
    { searchText: search, maxLookups: 25 },
  );
  assert.equal(result.size, 0, "no valid resolutions for invalid inputs");
});

test("resolvePlaceNames nulls non-https website URLs", async () => {
  const search: PlaceSearchFn = async () => [
    {
      id: "p1",
      location: { latitude: STOCKHOLM.lat, longitude: STOCKHOLM.lng },
      googleMapsUri: "https://www.google.com/maps/x",
      websiteUri: "javascript:alert(1)",
    },
  ];
  const result = await resolvePlaceNames(["X"], STOCKHOLM, 25_000, { searchText: search, maxLookups: 25 });
  const r = result.get("X");
  assert.ok(r);
  assert.equal(r?.website_url, null);
  assert.equal(r?.maps_url, "https://www.google.com/maps/x");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx --test src/lib/places/__tests__/resolveBatch.test.ts`
Expected: FAIL with module-not-found for `@/lib/places/resolveBatch`.

- [ ] **Step 3: Implement `resolvePlaceNames`**

Create `src/lib/places/resolveBatch.ts`:

```ts
import { textSearch } from "@/lib/places/text-search";

export type ResolvedPlace = {
  place_id: string;
  maps_url: string;
  website_url: string | null;
};

type PlaceSearchResult = {
  id: string;
  location: { latitude: number; longitude: number };
  googleMapsUri?: string;
  websiteUri?: string | null;
};

export type PlaceSearchFn = (query: string) => Promise<PlaceSearchResult[]>;

const DEFAULT_MAX_LOOKUPS = 25;

function isValidName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 80;
}

function isHttps(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

// Haversine distance in metres.
function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export async function resolvePlaceNames(
  names: string[],
  destinationLatLng: { lat: number; lng: number },
  radiusMeters: number,
  options: { searchText?: PlaceSearchFn; maxLookups?: number } = {},
): Promise<Map<string, ResolvedPlace>> {
  const search: PlaceSearchFn =
    options.searchText ??
    (async (query) => {
      const results = await textSearch({ query, maxResults: 1 });
      // textSearch returns PlaceSummary; we re-fetch with details if we
      // need website. For now, the summary's `id` plus a generic Maps
      // URL is enough — Step 5 in lockAndDraft can later upgrade to
      // details for website_url. Keep this helper minimal.
      return results.map((r) => ({
        id: r.id,
        location: { latitude: r.location.latitude, longitude: r.location.longitude },
        googleMapsUri: `https://www.google.com/maps/place/?q=place_id:${r.id}`,
        websiteUri: null,
      }));
    });

  const maxLookups = options.maxLookups ?? DEFAULT_MAX_LOOKUPS;

  const seen = new Set<string>();
  const queue: string[] = [];
  for (const raw of names) {
    if (!isValidName(raw)) continue;
    const key = raw.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push(raw.trim());
    if (queue.length >= maxLookups) break;
  }

  const out = new Map<string, ResolvedPlace>();

  for (const name of queue) {
    let results: PlaceSearchResult[];
    try {
      results = await search(name);
    } catch (err) {
      console.error("[resolvePlaceNames] search threw, skipping", name, err);
      continue;
    }
    const top = results[0];
    if (!top) continue;
    const dist = distanceMeters(destinationLatLng, {
      lat: top.location.latitude,
      lng: top.location.longitude,
    });
    if (dist > radiusMeters) continue;
    out.set(name, {
      place_id: top.id,
      maps_url:
        isHttps(top.googleMapsUri ?? null)
          ? (top.googleMapsUri as string)
          : `https://www.google.com/maps/place/?q=place_id:${top.id}`,
      website_url: isHttps(top.websiteUri ?? null) ? (top.websiteUri as string) : null,
    });
  }

  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec tsx --test src/lib/places/__tests__/resolveBatch.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/places/resolveBatch.ts src/lib/places/__tests__/resolveBatch.test.ts
git commit -m "feat(places): batched name->place_id resolver with distance + URL validation"
```

---

## Task 3: AI Zod schema updates

**Files:**
- Modify: `src/lib/ai/schema.ts`

- [ ] **Step 1: Add new Zod shapes**

Open `src/lib/ai/schema.ts`. Find the existing schemas. Add at the top (after imports):

```ts
const ScheduleItemPlaceSchema = z.object({
  name: z.string().min(2).max(80),
});

const PlaceListSchema = z.array(ScheduleItemPlaceSchema).max(4).default([]);
```

- [ ] **Step 2: Extend `SetupScheduleRowSchema`**

Replace the existing `SetupScheduleRowSchema` definition:

```ts
export const SetupScheduleRowSchema = z.object({
  day_label: z.string().min(1).max(30),
  heading: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  places: PlaceListSchema,
});
```

- [ ] **Step 3: Extend `SetupBookingSchema`**

Replace the existing definition:

```ts
export const SetupBookingSchema = z.object({
  title: z.string().min(1).max(100),
  place_name: z.string().min(2).max(80).optional(),
});
```

- [ ] **Step 4: Replace `whereToStay` shape in `EnrichedDraftSchema`**

Find the `whereToStay` array and replace its inner shape with neighbourhood-only:

```ts
whereToStay: z.array(
  z.object({
    neighbourhood: z.string().min(2).max(80),
    description: z.string().min(2).max(300),
    bestFor: z.string().min(2).max(60),
  }),
).min(1).max(5),
```

(Drop the `hotelSuggestions: z.array(DraftHotelSuggestionSchema)` line entirely. Hotels now come from SerpApi at draft-time, not from the AI.)

You can also delete the now-unused `DraftHotelSuggestionSchema` definition if it appears earlier in the file.

- [ ] **Step 5: Verify schema still compiles + run any existing schema tests**

Run: `pnpm exec tsc --noEmit`
Expected: no errors in `src/lib/ai/schema.ts`. May surface a few errors in **readers** (e.g. `EnrichedDraftView.tsx` reading `hotelSuggestions`) — those will be fixed in Task 6.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/schema.ts
git commit -m "refactor(ai): structured places on schedule/bookings, neighbourhoods-only hotels"
```

---

## Task 4: AI prompt rewrite

**Files:**
- Modify: `src/lib/ai/prompts.ts`

- [ ] **Step 1: Update LINKS + REQUIREMENTS section**

Open `src/lib/ai/prompts.ts`. Find the `LINKS` block and the `REQUIREMENTS` block in `buildEnrichedDraftPrompt`. Replace the LINKS + first 3 REQUIREMENTS items with:

```
LINKS
- Flight search URL, use exactly: ${flightSearchUrl}
- Do not embed any other URLs in your output. The platform resolves place links server-side.

REQUIREMENTS
1. Use only places from REAL DESTINATION DATA. Do not invent attractions, restaurants, or hotels.
2. When referencing a place from the data, include its placeId in the activity object.
3. Hotels: do NOT emit specific hotel names. For each "whereToStay" entry, give only neighbourhood + description + bestFor. The platform sources specific hotels separately.
```

Renumber the rest if needed.

- [ ] **Step 2: Add new requirement about places arrays**

Append after the renumbered list:

```
N. For every schedule day item, populate `places` with up to 4 entries from REAL DESTINATION DATA — just `{ name }`, no URLs. The platform resolves these to verified Google Maps + website links.
N+1. For every bookAhead item that targets a specific venue, set `place_name` to that venue's exact name from REAL DESTINATION DATA. Skip `place_name` for generic bookings (e.g. "Book the morning train").
N+2. Do not output any URLs in `body`, `description`, or any free-text field. URLs in prose will be silently stripped.
```

- [ ] **Step 3: Verify prompt example payload still matches new schema**

Find the example JSON inside the prompt template (around the existing `"hotelSuggestions": [...]`). Update:

- Drop the `hotelSuggestions: [...]` lines from the `whereToStay` example entries.
- For at least two `schedule` example entries, add a `"places": [{ "name": "..." }]` array.
- For at least one `bookAhead` example, add `"place_name": "..."`.

- [ ] **Step 4: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no new errors. (Errors in `EnrichedDraftView.tsx` reading old fields are fixed in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/prompts.ts
git commit -m "refactor(ai): forbid inline URLs, require structured place names per schedule day"
```

---

## Task 5: `lockAndDraft` Step 2 (places resolution) + regeneration policy

**Files:**
- Modify: `src/lib/actions/lockAndDraft.ts`

- [ ] **Step 1: Add helper imports**

At the top of `src/lib/actions/lockAndDraft.ts`, add:

```ts
import { resolvePlaceNames, type ResolvedPlace } from "@/lib/places/resolveBatch";
```

- [ ] **Step 2: Add the regeneration snapshot helper inside the action**

Find the section that deletes existing AI-drafted bookings (look for `.eq("ai_drafted", true)` near booking inserts). Before the delete, take a snapshot:

```ts
// Spec B: preserve manual edits across regeneration. Snapshot
// (lower-cased title) → { custom_url, assignee_id, done } for the
// existing AI-drafted bookings, then merge them back into the new
// rows by exact-title match after re-emitting.
const { data: existingBookings } = await supabase
  .from("bookings")
  .select("title, custom_url, assignee_id, done")
  .eq("trip_id", tripId)
  .eq("ai_drafted", true);

const bookingSnapshot = new Map<
  string,
  { custom_url: string | null; assignee_id: string | null; done: boolean }
>();
for (const b of existingBookings ?? []) {
  bookingSnapshot.set(b.title.toLowerCase().trim(), {
    custom_url: b.custom_url ?? null,
    assignee_id: b.assignee_id ?? null,
    done: !!b.done,
  });
}
```

Do the same pattern for activities (snapshot any user-set fields you preserve). For activities the preserved fields are nothing user-mutable today (votes are FK'd separately and not touched by the regen) — so just snapshot the title for matching, no preserved-fields map needed yet. Mark a TODO comment `// Future: preserve activity user-state when added`.

- [ ] **Step 3: Add Places resolution after Gemini returns**

After Gemini returns the validated draft (the call site that produces the parsed `Draft` object), insert the resolution step:

```ts
// Spec B Step 2: resolve every place name to a verified place_id.
// Failures degrade gracefully (empty places array) — never block
// draft save.
const allNames = new Set<string>();
for (const day of draft.itinerary ?? []) {
  for (const block of day.blocks ?? []) {
    for (const a of block.activities ?? []) {
      if (a.placeId) continue; // already grounded by Gemini from REAL DESTINATION DATA
      // The Setup schedule rows live separately from itinerary blocks.
    }
  }
}
for (const row of draft.setup?.schedule ?? []) {
  for (const p of row.places ?? []) allNames.add(p.name);
}
for (const b of draft.setup?.bookings ?? []) {
  if (b.place_name) allNames.add(b.place_name);
}

const destLatLng = enriched.resolved?.location
  ? { lat: enriched.resolved.location.latitude, lng: enriched.resolved.location.longitude }
  : null;

let resolvedMap = new Map<string, ResolvedPlace>();
if (destLatLng && allNames.size > 0) {
  try {
    resolvedMap = await resolvePlaceNames(
      Array.from(allNames),
      destLatLng,
      50_000,
    );
  } catch (err) {
    console.error("[lockAndDraft] places resolution failed, continuing", err);
    await logAiUsage({
      userId,
      tripId,
      feature: "lock_and_draft_places_resolution",
      model: "google-places",
      estimatedCostGBP: 0,
      succeeded: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}
```

- [ ] **Step 4: Apply resolutions to schedule + bookings before write**

After the resolution map is built and before the schedule/bookings are persisted, mutate the draft data:

```ts
// Apply to schedule rows.
for (const row of draft.setup?.schedule ?? []) {
  if (!row.places) continue;
  row.places = row.places.map((p) => {
    const r = resolvedMap.get(p.name);
    return {
      name: p.name,
      place_id: r?.place_id ?? null,
      maps_url: r?.maps_url ?? null,
      website_url: r?.website_url ?? null,
    };
  });
}

// Apply to bookings rows being inserted.
const bookingRowsForInsert = (draft.setup?.bookings ?? []).map((b, i) => {
  const r = b.place_name ? resolvedMap.get(b.place_name) : null;
  const titleKey = b.title.toLowerCase().trim();
  const preserved = bookingSnapshot.get(titleKey);
  return {
    trip_id: tripId,
    title: b.title,
    position: i,
    ai_drafted: true,
    place_id: r?.place_id ?? null,
    maps_url: r?.maps_url ?? null,
    website_url: r?.website_url ?? null,
    custom_url: preserved?.custom_url ?? null,
    assignee_id: preserved?.assignee_id ?? null,
    done: preserved?.done ?? false,
  };
});
```

Use `bookingRowsForInsert` in the existing `.from("bookings").insert(...)` call.

For activities, do the analogous mapping at the existing activities insert site, attaching `place_id` and `maps_url` where the AI emitted a `placeId` (you can look up that place's googleMapsUri from `enriched.topAttractions` etc., or skip and rely on the existing `website_url` from Phase 4 backfill).

- [ ] **Step 5: Strip URLs from prose `body`**

After Gemini returns and before save, sanitise:

```ts
const URL_RE = /https?:\/\/\S+/g;
for (const row of draft.setup?.schedule ?? []) {
  if (typeof row.body === "string") {
    row.body = row.body.replace(URL_RE, "").replace(/\s+/g, " ").trim();
  }
}
```

- [ ] **Step 6: Type-check + manual smoke**

Run: `pnpm exec tsc --noEmit`
Expected: no errors in `lockAndDraft.ts`. (Errors in readers fixed in Task 6.)

If you have a test trip available locally, run a Lock & Draft and verify in the DB that `bookings.place_id` is populated for at least some rows and `meta.schedule[i].places` contains entries with non-null place_ids for known attractions.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/lockAndDraft.ts
git commit -m "feat(lockAndDraft): resolve place names + preserve manual booking edits across regen"
```

---

## Task 6: Schedule pills UI in `EnrichedDraftView`

**Files:**
- Modify: `src/components/overview/EnrichedDraftView.tsx`

- [ ] **Step 1: Drop `hotelSuggestions` rendering**

Find the `area.hotelSuggestions.map(...)` block. Delete it entirely. The `whereToStay` cards now render only `neighbourhood`/`description`/`bestFor`. The hotel-pick UI moves to the StaySheet (Phase 2).

- [ ] **Step 2: Add `Pill` sub-component for places**

At the top of the file (after imports, before `EnrichedDraftView`):

```tsx
function PlacePill({
  name,
  mapsUrl,
}: {
  name: string;
  mapsUrl: string | null;
}) {
  if (!mapsUrl) return <span className="text-fg-3 text-[12px]">{name}</span>;
  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-1 border border-line bg-bg-2 text-[12px] hover:bg-bg-3"
    >
      {name}
      <span aria-hidden className="text-fg-3">↗</span>
    </a>
  );
}
```

- [ ] **Step 3: Render pills under each schedule body**

Find where `schedule` items are rendered (look for `draft.itinerary` or `setup.schedule`). Below each item's body, add:

```tsx
{row.places && row.places.length > 0 && (
  <div className="mt-3 flex flex-wrap gap-2">
    <span className="label-sm text-fg-3 mr-2">Places mentioned</span>
    {row.places.map((p) => (
      <PlacePill key={`${p.name}-${p.place_id ?? "miss"}`} name={p.name} mapsUrl={p.maps_url} />
    ))}
  </div>
)}
```

(Pill renders as plain text when `maps_url` is null — per spec §2.5 rule 2.)

- [ ] **Step 4: Type-check + visual smoke**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

Run: `pnpm dev`, navigate to a recently-drafted trip's overview. Confirm:
- Schedule day rows render link-free body prose.
- "Places mentioned" pills appear with verified link icons.
- Hotel cards now show neighbourhood + description + bestFor only (no `hotelSuggestions`).

- [ ] **Step 5: Commit**

```bash
git add src/components/overview/EnrichedDraftView.tsx
git commit -m "feat(overview): render verified place pills under schedule days"
```

---

## Task 7: BookingsList Maps + Website icons

**Files:**
- Modify: `src/components/bookings/BookingsList.tsx`

- [ ] **Step 1: Update grid to accommodate icons**

Find the existing booking row `<div>` with `grid-cols-[28px_1fr_180px_36px]`. Change the grid to add a slot for the link icons:

```tsx
className={`group grid grid-cols-[28px_1fr_auto_180px_36px] max-[520px]:grid-cols-[28px_1fr_auto_36px] items-center py-4 px-6 border-b border-line last:border-b-0 gap-4 max-[400px]:gap-3 ${
  b.done ? "opacity-50" : ""
}`}
```

- [ ] **Step 2: Add icon row inline**

Between the title `<div>` and the `<select>`, insert:

```tsx
<div className="flex items-center gap-1.5">
  {b.custom_url ? (
    <a
      href={b.custom_url}
      target="_blank"
      rel="noopener noreferrer"
      className="px-2 py-1 border border-line bg-bg-2 text-[11px] font-mono uppercase tracking-[0.05em] hover:bg-bg-3"
      aria-label={`Open booking link for ${b.title}`}
    >
      Book →
    </a>
  ) : (
    <>
      {b.maps_url && (
        <a
          href={b.maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 inline-flex items-center justify-center border border-line bg-bg-2 text-[12px] hover:bg-bg-3"
          aria-label={`Maps for ${b.title}`}
          title="Open in Maps"
        >
          📍
        </a>
      )}
      {b.website_url && b.website_url !== b.maps_url && (
        <a
          href={b.website_url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 inline-flex items-center justify-center border border-line bg-bg-2 text-[12px] hover:bg-bg-3"
          aria-label={`Website for ${b.title}`}
          title="Visit website"
        >
          🌐
        </a>
      )}
    </>
  )}
</div>
```

- [ ] **Step 3: Type-check + visual smoke**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

Run dev, open a trip's `/bookings` page. Verify:
- AI-drafted rows with resolved place_ids show 📍 icon (and 🌐 when website_url differs from maps_url).
- Manual rows (no place_id) show no icons.
- Mobile (< 520px): the extra slot collapses cleanly via the responsive grid.

- [ ] **Step 4: Commit**

```bash
git add src/components/bookings/BookingsList.tsx
git commit -m "feat(bookings): surface verified Maps + Website links per row"
```

---

## Task 8: ShortlistBoard activity website link

**Files:**
- Modify: `src/components/shortlist/ShortlistBoard.tsx`

- [ ] **Step 1: Add website link below activity title**

Find where activity titles are rendered. Below the title `<h3>` or equivalent, add:

```tsx
{activity.website_url && (
  <a
    href={activity.website_url}
    target="_blank"
    rel="noopener noreferrer"
    className="text-[12px] text-fg-3 hover:text-fg-2 inline-flex items-center gap-1 mt-1"
  >
    Visit website <span aria-hidden>↗</span>
  </a>
)}
```

- [ ] **Step 2: Type-check + visual smoke**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

Run dev, open `/shortlist` for a drafted trip. AI-drafted activities with `website_url` show the new link; activities without are unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/components/shortlist/ShortlistBoard.tsx
git commit -m "feat(shortlist): surface activity website link when present"
```

---

## Phase 1 Ship Gate

- [ ] **Step 1: Type-check, build, full Playwright run**

Run sequentially:
```bash
pnpm exec tsc --noEmit
pnpm build
pnpm test:setup
pnpm test
```
All must pass.

- [ ] **Step 2: Manual QA on three real destinations**

In a Vercel preview deploy:
- Lock & Draft on a fresh test trip with destination = Stockholm. Verify schedule pills resolve (Vasa Museum, Fotografiska, etc.). Verify bookings rows have 📍 icons.
- Repeat for Lisbon.
- Repeat for Marrakesh.

For each: confirm zero broken links (every pill click opens a real Google Maps page; every 📍 icon click opens the venue).

- [ ] **Step 3: Manual QA on regeneration**

On one of the test trips, manually:
1. Set a `custom_url` on one ai_drafted booking via SQL: `update bookings set custom_url = 'https://example.com/book' where id = '...';`
2. Assign that booking to a crew member via the UI.
3. Re-run Lock & Draft.
4. Verify the booking still has `custom_url = 'https://example.com/book'` and the same `assignee_id` after regen.

- [ ] **Step 4: Merge to main**

If all checks pass:
```bash
git push origin <branch>
# Open PR, get review, merge
```

---

# Phase 2 — Live pricing (gated by `serpApiEnabled()`)

## Task 9: Extend `LivePricing` types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add new pricing types**

Find the existing `LivePricing` definition. Replace with:

```ts
export type Money = { amount: number; currency: string };

export type SerpErrorCode =
  | "timeout"
  | "rate_limit"
  | "parse_error"
  | "no_results"
  | "provider_error"
  | "missing_input"
  | "monthly_budget_cap";

export type ErrorEnvelope = {
  code: SerpErrorCode;
  message: string;
  occurred_at: string;
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

export type FlightPricing = {
  // EXISTING fields preserved for backward compat with EnrichedDraftView
  low: number;
  high: number;
  currency: string;
  provider: "serpapi-google-flights";
  refreshed_at: string;
  origin_iata: string;
  destination_iata: string;
  // Spec B additions
  best_price?: Money;
  options?: FareOption[];
  fallback_deeplink?: string;
  fetch_error?: ErrorEnvelope | null;
};

export type HotelPricing = {
  quotes: HotelQuote[];
  refreshed_at: string;
  provider: "serpapi-google-hotels";
  fetch_error: ErrorEnvelope | null;
};

export type LivePricing = {
  flights?: FlightPricing;
  hotels?: HotelPricing;
};
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: clean (existing readers `livePricing?.flights?.low/high` still work because those fields are preserved).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): extend LivePricing with hotels + structured fare options"
```

---

## Task 10: Cost cap helper

**Files:**
- Create: `src/lib/serpapi/costCap.ts`
- Test: `src/lib/serpapi/__tests__/costCap.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/serpapi/__tests__/costCap.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { isUnderMonthlyCap } from "@/lib/serpapi/costCap";

test("isUnderMonthlyCap returns true when no cap configured", async () => {
  const result = await isUnderMonthlyCap({
    capGbp: null,
    spendGbp: 999,
  });
  assert.equal(result.allowed, true);
});

test("isUnderMonthlyCap allows when spend below cap", async () => {
  const result = await isUnderMonthlyCap({
    capGbp: 50,
    spendGbp: 12.34,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.spendGbp, 12.34);
});

test("isUnderMonthlyCap blocks when spend at or over cap", async () => {
  const result = await isUnderMonthlyCap({
    capGbp: 50,
    spendGbp: 50.01,
  });
  assert.equal(result.allowed, false);
  if (result.allowed) throw new Error("unreachable");
  assert.equal(result.code, "monthly_budget_cap");
});
```

- [ ] **Step 2: Run test (should fail with module-not-found)**

Run: `pnpm exec tsx --test src/lib/serpapi/__tests__/costCap.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/serpapi/costCap.ts`:

```ts
import { createServiceClient } from "@/lib/supabase/server";

export type CapCheck =
  | { allowed: true; spendGbp: number; capGbp: number | null }
  | { allowed: false; code: "monthly_budget_cap"; spendGbp: number; capGbp: number };

type Input = { capGbp: number | null; spendGbp: number };

export async function isUnderMonthlyCap(input: Input): Promise<CapCheck> {
  if (input.capGbp === null) {
    return { allowed: true, spendGbp: input.spendGbp, capGbp: null };
  }
  if (input.spendGbp >= input.capGbp) {
    return {
      allowed: false,
      code: "monthly_budget_cap",
      spendGbp: input.spendGbp,
      capGbp: input.capGbp,
    };
  }
  return { allowed: true, spendGbp: input.spendGbp, capGbp: input.capGbp };
}

// Higher-level helper used at runtime — not unit-tested directly because
// it hits the DB; covered by integration smoke instead.
export async function checkSerpApiBudget(): Promise<CapCheck> {
  const cap = process.env.SERPAPI_MONTHLY_CAP_GBP;
  const capGbp = cap ? Number.parseFloat(cap) : null;
  if (capGbp !== null && !Number.isFinite(capGbp)) {
    console.warn("[serpapi.costCap] SERPAPI_MONTHLY_CAP_GBP is not a number; treating as no cap");
    return { allowed: true, spendGbp: 0, capGbp: null };
  }

  const service = await createServiceClient();
  const since = new Date();
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  const { data, error } = await service
    .from("ai_usage")
    .select("estimated_cost_gbp, feature")
    .gte("created_at", since.toISOString());
  if (error) {
    console.error("[serpapi.costCap] failed to read ai_usage", error);
    return { allowed: true, spendGbp: 0, capGbp };
  }
  const spend = (data ?? [])
    .filter((r) => {
      const f = (r as { feature?: string | null }).feature ?? "";
      return f.startsWith("serpapi_") || f.startsWith("lock_and_draft_pricing_");
    })
    .reduce((sum, r) => sum + (Number((r as { estimated_cost_gbp?: number }).estimated_cost_gbp) || 0), 0);

  return isUnderMonthlyCap({ capGbp, spendGbp: spend });
}
```

- [ ] **Step 4: Run test (should pass)**

Run: `pnpm exec tsx --test src/lib/serpapi/__tests__/costCap.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/serpapi/costCap.ts src/lib/serpapi/__tests__/costCap.test.ts
git commit -m "feat(serpapi): monthly spend cap helper backed by ai_usage"
```

---

## Task 11: Implement `fetchHotelQuotes`

**Files:**
- Modify: `src/lib/serpapi/client.ts`
- Test: `src/lib/serpapi/__tests__/client.test.ts`

- [ ] **Step 1: Write the failing test using a recorded fixture**

Create `src/lib/serpapi/__tests__/client.test.ts` (or extend if it exists):

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { parseHotelResponse } from "@/lib/serpapi/client";

const FIXTURE = {
  properties: [
    {
      name: "Hotel Diplomat",
      place_id: "ChIJDiplomat",
      total_rate: { extracted_lowest: 600, extracted_currency: "GBP" },
      rate_per_night: { extracted_lowest: 120, extracted_currency: "GBP" },
      overall_rating: 4.7,
      images: [{ original_image: "https://example.com/img.jpg" }],
      link: "https://www.booking.com/hotel/...",
    },
    {
      name: "Hotel At Six",
      place_id: "ChIJAtSix",
      total_rate: { extracted_lowest: 725, extracted_currency: "GBP" },
      rate_per_night: { extracted_lowest: 145, extracted_currency: "GBP" },
      overall_rating: 4.5,
      images: [{ original_image: "https://example.com/img2.jpg" }],
      link: "https://www.booking.com/hotel/atsix",
    },
  ],
};

test("parseHotelResponse takes top 3 sorted by rating", () => {
  const quotes = parseHotelResponse(FIXTURE, "GBP");
  assert.equal(quotes.length, 2); // fixture has only 2
  assert.equal(quotes[0].name, "Hotel Diplomat");
  assert.equal(quotes[0].price_per_night.amount, 120);
  assert.equal(quotes[0].total_price.amount, 600);
  assert.equal(quotes[0].place_id, "ChIJDiplomat");
});

test("parseHotelResponse drops entries without prices", () => {
  const fixture = {
    properties: [
      { name: "No Price Hotel", place_id: "ChIJNo", overall_rating: 5.0, images: [], link: "https://x" },
    ],
  };
  const quotes = parseHotelResponse(fixture, "GBP");
  assert.equal(quotes.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx --test src/lib/serpapi/__tests__/client.test.ts`
Expected: FAIL with "parseHotelResponse is not a function" (or undefined export).

- [ ] **Step 3: Implement parser + fetcher in `src/lib/serpapi/client.ts`**

Append to the existing `src/lib/serpapi/client.ts`:

```ts
import type { HotelQuote } from "@/lib/types";

export type HotelSearch = {
  destination: string;
  checkIn: string;        // YYYY-MM-DD
  checkOut: string;       // YYYY-MM-DD
  rooms: number;
  perRoomBudget?: number; // GBP nightly upper bound
  currency: string;       // e.g. "GBP"
};

type SerpHotelProperty = {
  name?: string;
  place_id?: string;
  total_rate?: { extracted_lowest?: number; extracted_currency?: string };
  rate_per_night?: { extracted_lowest?: number; extracted_currency?: string };
  overall_rating?: number;
  images?: Array<{ original_image?: string; thumbnail?: string }>;
  link?: string;
};

type SerpHotelResponse = {
  properties?: SerpHotelProperty[];
  error?: string;
};

export function parseHotelResponse(
  raw: unknown,
  currency: string,
): HotelQuote[] {
  if (!raw || typeof raw !== "object") return [];
  const json = raw as SerpHotelResponse;
  const properties = Array.isArray(json.properties) ? json.properties : [];
  const quotes: HotelQuote[] = [];

  for (const p of properties) {
    const ppNight = p.rate_per_night?.extracted_lowest;
    const ppTotal = p.total_rate?.extracted_lowest;
    if (typeof ppNight !== "number" || typeof ppTotal !== "number") continue;
    if (ppNight <= 0 || ppTotal <= 0) continue;
    const name = (p.name ?? "").trim();
    if (!name) continue;
    quotes.push({
      name,
      place_id: p.place_id ?? null,
      rating: typeof p.overall_rating === "number" ? p.overall_rating : null,
      price_per_night: { amount: Math.round(ppNight), currency },
      total_price: { amount: Math.round(ppTotal), currency },
      thumbnail_url: p.images?.[0]?.thumbnail ?? p.images?.[0]?.original_image ?? null,
      deeplink: p.link ?? "",
    });
  }

  // Sort by rating desc, then price asc
  quotes.sort((a, b) => {
    const ra = a.rating ?? 0;
    const rb = b.rating ?? 0;
    if (rb !== ra) return rb - ra;
    return a.price_per_night.amount - b.price_per_night.amount;
  });

  return quotes.slice(0, 3);
}

export async function fetchHotelQuotes(
  search: HotelSearch,
): Promise<HotelQuote[] | null> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    engine: "google_hotels",
    q: search.destination,
    check_in_date: search.checkIn,
    check_out_date: search.checkOut,
    adults: String(Math.max(1, search.rooms * 2)),
    currency: search.currency,
    hl: "en",
    api_key: apiKey,
  });
  if (search.perRoomBudget && search.perRoomBudget > 0) {
    params.set("max_price", String(Math.round(search.perRoomBudget)));
  }

  const url = `${SERPAPI_BASE}?${params.toString()}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } catch (err) {
    console.error("[serpapi.hotels] network error", err);
    return null;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[serpapi.hotels] HTTP ${res.status}: ${body.slice(0, 200)}`);
    return null;
  }
  const json = (await res.json()) as SerpHotelResponse;
  if (json.error) {
    console.error("[serpapi.hotels] api error:", json.error);
    return null;
  }
  return parseHotelResponse(json, search.currency);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec tsx --test src/lib/serpapi/__tests__/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/serpapi/client.ts src/lib/serpapi/__tests__/client.test.ts
git commit -m "feat(serpapi): fetchHotelQuotes + parseHotelResponse with rating-then-price sort"
```

---

## Task 12: Extend `fetchFlightPrices` to return options

**Files:**
- Modify: `src/lib/serpapi/client.ts`
- Test: `src/lib/serpapi/__tests__/client.test.ts` (extend)

- [ ] **Step 1: Add failing test**

Append to `src/lib/serpapi/__tests__/client.test.ts`:

```ts
import { parseFlightOptions } from "@/lib/serpapi/client";

const FLIGHT_FIXTURE = {
  best_flights: [
    {
      price: 242,
      flights: [
        {
          airline: "British Airways",
          airline_logo: "https://example.com/ba.png",
          duration: 405,
          departure_airport: { time: "2026-08-12 09:25" },
          arrival_airport: { time: "2026-08-12 12:10" },
        },
      ],
      booking_token: "tok_BA",
    },
    {
      price: 268,
      flights: [
        {
          airline: "SAS",
          airline_logo: "https://example.com/sas.png",
          duration: 390,
          departure_airport: { time: "2026-08-12 12:10" },
          arrival_airport: { time: "2026-08-12 14:40" },
        },
      ],
      booking_token: "tok_SAS",
    },
  ],
  other_flights: [
    {
      price: 312,
      flights: [
        {
          airline: "British Airways",
          airline_logo: "https://example.com/ba.png",
          duration: 550,
          departure_airport: { time: "2026-08-12 06:00" },
          arrival_airport: { time: "2026-08-12 16:30" },
          layovers: [{}],
        },
      ],
      booking_token: "tok_BA2",
    },
  ],
};

test("parseFlightOptions returns top 3 ascending by price", () => {
  const opts = parseFlightOptions(FLIGHT_FIXTURE, "GBP");
  assert.equal(opts.length, 3);
  assert.equal(opts[0].price.amount, 242);
  assert.equal(opts[1].price.amount, 268);
  assert.equal(opts[2].price.amount, 312);
  assert.equal(opts[2].stops, 1);
});
```

- [ ] **Step 2: Run test (should fail)**

Run: `pnpm exec tsx --test src/lib/serpapi/__tests__/client.test.ts`
Expected: FAIL on `parseFlightOptions is not a function`.

- [ ] **Step 3: Implement**

In `src/lib/serpapi/client.ts`, add:

```ts
import type { FareOption } from "@/lib/types";

type SerpFlight = {
  airline?: string;
  airline_logo?: string;
  duration?: number;
  departure_airport?: { time?: string };
  arrival_airport?: { time?: string };
  layovers?: unknown[];
};

type SerpFlightOption = {
  price?: number;
  flights?: SerpFlight[];
  booking_token?: string;
};

const SERPAPI_FLIGHT_DEEPLINK_BASE = "https://www.google.com/travel/flights/booking";

export function parseFlightOptions(raw: unknown, currency: string): FareOption[] {
  if (!raw || typeof raw !== "object") return [];
  const j = raw as { best_flights?: SerpFlightOption[]; other_flights?: SerpFlightOption[] };
  const all = [...(j.best_flights ?? []), ...(j.other_flights ?? [])];
  const options: FareOption[] = [];
  for (const opt of all) {
    if (typeof opt.price !== "number" || opt.price <= 0) continue;
    const first = opt.flights?.[0];
    if (!first) continue;
    options.push({
      airline: first.airline ?? "—",
      airline_logo_url: first.airline_logo ?? null,
      price: { amount: Math.round(opt.price), currency },
      duration_minutes: typeof first.duration === "number" ? first.duration : 0,
      stops: Array.isArray(first.layovers) ? first.layovers.length : 0,
      depart_iso: first.departure_airport?.time ?? "",
      arrive_iso: first.arrival_airport?.time ?? "",
      deeplink: opt.booking_token
        ? `${SERPAPI_FLIGHT_DEEPLINK_BASE}?token=${encodeURIComponent(opt.booking_token)}`
        : "",
    });
  }
  options.sort((a, b) => a.price.amount - b.price.amount);
  return options.slice(0, 3);
}
```

Then update the existing `fetchFlightPrices` return shape. Find:

```ts
export type FlightPrices = {
  low: number;
  high: number;
  currency: string;
  sampleCount: number;
};
```

Replace with:

```ts
export type FlightPrices = {
  low: number;
  high: number;
  currency: string;
  sampleCount: number;
  options: FareOption[];
  best_price: { amount: number; currency: string };
};
```

In `fetchFlightPrices`, after the existing `prices` array is built, add:

```ts
const options = parseFlightOptions(json, search.currency);
const best = options[0]?.price ?? { amount: Math.round(Math.min(...prices)), currency: search.currency };
return {
  low: Math.round(Math.min(...prices)),
  high: Math.round(Math.max(...prices)),
  currency: search.currency,
  sampleCount: prices.length,
  options,
  best_price: best,
};
```

- [ ] **Step 4: Run test (should pass)**

Run: `pnpm exec tsx --test src/lib/serpapi/__tests__/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: clean. Existing `priceRefresh.ts` uses `low/high/currency` — those still exist on the new return type.

- [ ] **Step 6: Commit**

```bash
git add src/lib/serpapi/client.ts src/lib/serpapi/__tests__/client.test.ts
git commit -m "feat(serpapi): fetchFlightPrices returns top-3 fare options"
```

---

## Task 13: `isPioneerForTrip` helper

**Files:**
- Modify: `src/lib/plan.ts`

- [ ] **Step 1: Add helper**

Append to `src/lib/plan.ts`:

```ts
// Returns true if any trip admin has profiles.founding_crew_at IS NOT
// NULL. Mirrors hasProAccessForTrip's "any-admin-pays" semantics.
export async function isPioneerForTrip(
  userId: string,
  tripId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("founding_crew_at")
    .eq("id", userId)
    .maybeSingle<{ founding_crew_at: string | null }>();
  if (profile?.founding_crew_at) return true;

  const { data, error } = await supabase
    .from("trip_members")
    .select(
      `
      user_id,
      profiles!inner (
        founding_crew_at
      )
    `,
    )
    .eq("trip_id", tripId)
    .eq("role", "admin");

  if (error || !data) return false;

  return data.some((member) => {
    const p = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
    return !!p?.founding_crew_at;
  });
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/plan.ts
git commit -m "feat(plan): isPioneerForTrip helper for price-visibility gating"
```

---

## Task 14: Extend `refreshPrices` for hotels + per-side errors

**Files:**
- Modify: `src/lib/actions/priceRefresh.ts`

- [ ] **Step 1: Update imports**

Top of file, add:

```ts
import { fetchFlightPrices, fetchHotelQuotes, serpApiEnabled } from "@/lib/serpapi/client";
import { checkSerpApiBudget } from "@/lib/serpapi/costCap";
import type { LivePricing, HotelPricing, FlightPricing, ErrorEnvelope, TripMeta } from "@/lib/types";
```

- [ ] **Step 2: Add cost-cap pre-flight at top of action body**

Right after the `if (!serpApiEnabled())` check, add:

```ts
const cap = await checkSerpApiBudget();
if (!cap.allowed) {
  await logAiUsage({
    userId,
    tripId,
    feature: "price_refresh",
    model: "none",
    estimatedCostGBP: 0,
    succeeded: false,
    errorMessage: "monthly_budget_cap",
  });
  return {
    success: false,
    error: "Monthly pricing budget reached. Refresh disabled until next month.",
    upgradeCta: false,
  };
}
```

- [ ] **Step 3: Run flights + hotels in parallel**

Find the existing `fetchFlightPrices(...)` call. Replace that block (the call + the `if (!prices)` early return) with:

```ts
const tripDays = (() => {
  if (!trip.start_date || !trip.end_date) return null;
  const ms = Date.parse(trip.end_date) - Date.parse(trip.start_date);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.max(1, Math.round(ms / 86_400_000));
})();
const targetBudgetPp = trip.target_budget_pp ?? null;
const perRoomBudget =
  targetBudgetPp && tripDays
    ? (targetBudgetPp * 0.4) / tripDays * 2
    : undefined;

const rooms = Math.max(1, Math.ceil((trip.target_crew_size ?? 1) / 2));

const [flightResult, hotelResult] = await Promise.allSettled([
  fetchFlightPrices({
    originIata,
    destinationIata,
    outboundDate: trip.start_date,
    returnDate: trip.end_date,
    adults,
    currency,
  }),
  fetchHotelQuotes({
    destination: trip.destination,
    checkIn: trip.start_date,
    checkOut: trip.end_date,
    rooms,
    perRoomBudget,
    currency,
  }),
]);

const refreshedAt = new Date().toISOString();
const nowError = (code: ErrorEnvelope["code"], message: string): ErrorEnvelope => ({
  code,
  message,
  occurred_at: refreshedAt,
});

let flights: FlightPricing | undefined;
let flightError: ErrorEnvelope | null = null;
if (flightResult.status === "fulfilled" && flightResult.value) {
  const fp = flightResult.value;
  flights = {
    low: fp.low,
    high: fp.high,
    currency: fp.currency,
    provider: "serpapi-google-flights",
    refreshed_at: refreshedAt,
    origin_iata: originIata,
    destination_iata: destinationIata,
    best_price: fp.best_price,
    options: fp.options,
    fetch_error: null,
  };
} else if (flightResult.status === "rejected") {
  flightError = nowError("provider_error", String(flightResult.reason));
} else {
  flightError = nowError("no_results", "SerpApi returned no flights for this route + dates.");
}

let hotels: HotelPricing | undefined;
if (hotelResult.status === "fulfilled" && hotelResult.value && hotelResult.value.length > 0) {
  hotels = {
    quotes: hotelResult.value,
    refreshed_at: refreshedAt,
    provider: "serpapi-google-hotels",
    fetch_error: null,
  };
} else if (hotelResult.status === "rejected") {
  hotels = {
    quotes: [],
    refreshed_at: refreshedAt,
    provider: "serpapi-google-hotels",
    fetch_error: nowError("provider_error", String(hotelResult.reason)),
  };
} else {
  hotels = {
    quotes: [],
    refreshed_at: refreshedAt,
    provider: "serpapi-google-hotels",
    fetch_error: nowError("no_results", "SerpApi returned no hotels."),
  };
}

if (flightError) {
  // Preserve previous live_pricing.flights if any, attach the error.
  const prev = trip.meta?.live_pricing?.flights;
  flights = prev
    ? { ...prev, fetch_error: flightError }
    : {
        low: 0,
        high: 0,
        currency,
        provider: "serpapi-google-flights",
        refreshed_at: refreshedAt,
        origin_iata: originIata,
        destination_iata: destinationIata,
        fetch_error: flightError,
      };
}

const livePricing: LivePricing = { flights, hotels };
```

- [ ] **Step 4: Replace the existing single-side persist with both-side persist**

Find the existing `nextMeta`/`update({ meta: nextMeta })` block. Replace with:

```ts
const nextMeta: TripMeta = {
  ...(trip.meta ?? {}),
  live_pricing: livePricing,
};

const service = await createServiceClient();
const { error: updateError } = await service
  .from("trips")
  .update({ meta: nextMeta })
  .eq("id", tripId);

if (updateError) {
  console.error("[priceRefresh] meta update failed", updateError);
  return {
    success: false,
    error: "Saved the refresh timestamp but couldn't persist prices.",
    upgradeCta: false,
  };
}
```

The existing `record_price_refresh` RPC and `logAiUsage` call below stay as-is; both now reflect "we tried" regardless of which side succeeded.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/priceRefresh.ts
git commit -m "feat(priceRefresh): also fetch hotels with per-side error envelopes + cost cap"
```

---

## Task 15: `lockAndDraft` Step 3 — hotel call for all `pro` users

**Files:**
- Modify: `src/lib/actions/lockAndDraft.ts`

- [ ] **Step 1: Add imports**

```ts
import { fetchHotelQuotes, fetchFlightPrices, serpApiEnabled } from "@/lib/serpapi/client";
import { checkSerpApiBudget } from "@/lib/serpapi/costCap";
import { isPioneerForTrip, hasProAccess } from "@/lib/plan";
import { resolveOriginIata, resolveDestinationIata } from "@/lib/iata";
import type { LivePricing, HotelPricing, FlightPricing, ErrorEnvelope } from "@/lib/types";
```

(Some may already be imported — keep one copy.)

- [ ] **Step 2: Build the live_pricing skeleton inside the action**

After the draft data is parsed but before the final persist, write an empty live_pricing shell so realtime listeners have something to react to even if the SerpApi calls in this same `after()` are reaped:

```ts
const initialLivePricing: LivePricing = { flights: undefined, hotels: undefined };
// Persist into meta.live_pricing alongside the rest of the meta write
// the existing pipeline already does. Find the meta-update site and
// merge { live_pricing: initialLivePricing } into the next meta object.
```

Locate the existing meta-write site that writes `spec_grid`, `schedule`, etc. Add `live_pricing: initialLivePricing` to the spread.

- [ ] **Step 3: Run hotel SerpApi for `pro` users (Member + Pioneer) in `after()` block**

After the main draft persist returns, in the existing `after()` block, add:

```ts
if (params.tier === "enriched" && serpApiEnabled() && trip.start_date && trip.end_date && trip.destination) {
  const cap = await checkSerpApiBudget();
  if (!cap.allowed) {
    console.warn("[lockAndDraft] SerpApi cap reached, skipping pricing fetch");
  } else {
    const tripDays = Math.max(
      1,
      Math.round(
        (Date.parse(trip.end_date) - Date.parse(trip.start_date)) / 86_400_000,
      ),
    );
    const rooms = Math.max(1, Math.ceil((trip.target_crew_size ?? 1) / 2));
    const perRoomBudget = trip.target_budget_pp
      ? (trip.target_budget_pp * 0.4) / tripDays * 2
      : undefined;
    const currency = trip.currency ?? "GBP";

    let hotelQuotes;
    try {
      hotelQuotes = await fetchHotelQuotes({
        destination: trip.destination,
        checkIn: trip.start_date,
        checkOut: trip.end_date,
        rooms,
        perRoomBudget,
        currency,
      });
    } catch (err) {
      console.error("[lockAndDraft] hotels fetch failed", err);
      hotelQuotes = null;
    }

    const refreshedAt = new Date().toISOString();
    const hotels: HotelPricing | undefined = hotelQuotes && hotelQuotes.length > 0
      ? {
          quotes: hotelQuotes,
          refreshed_at: refreshedAt,
          provider: "serpapi-google-hotels",
          fetch_error: null,
        }
      : {
          quotes: [],
          refreshed_at: refreshedAt,
          provider: "serpapi-google-hotels",
          fetch_error: {
            code: "no_results",
            message: "SerpApi returned no hotels at draft time.",
            occurred_at: refreshedAt,
          },
        };

    const isPioneer = await isPioneerForTrip(userId, tripId);
    let flights: FlightPricing | undefined;
    if (isPioneer) {
      const originRaw = enriched?.preferences?.origin ?? trip.meta?.ai_preferences?.origin ?? null;
      const originIata = resolveOriginIata(originRaw);
      const destinationIata = resolveDestinationIata(trip.destination);
      if (originIata && destinationIata) {
        try {
          const fp = await fetchFlightPrices({
            originIata,
            destinationIata,
            outboundDate: trip.start_date,
            returnDate: trip.end_date,
            adults: Math.max(1, trip.target_crew_size ?? 1),
            currency,
          });
          if (fp) {
            flights = {
              low: fp.low,
              high: fp.high,
              currency: fp.currency,
              provider: "serpapi-google-flights",
              refreshed_at: refreshedAt,
              origin_iata: originIata,
              destination_iata: destinationIata,
              best_price: fp.best_price,
              options: fp.options,
              fetch_error: null,
            };
          }
        } catch (err) {
          console.error("[lockAndDraft] flights fetch failed", err);
        }
      }
    }

    const service = await createServiceClient();
    const { data: latest } = await service
      .from("trips")
      .select("meta")
      .eq("id", tripId)
      .maybeSingle<{ meta: TripMeta | null }>();
    const nextMeta: TripMeta = {
      ...(latest?.meta ?? {}),
      live_pricing: { flights, hotels },
    };
    await service.from("trips").update({ meta: nextMeta }).eq("id", tripId);

    await logAiUsage({
      userId,
      tripId,
      feature: "lock_and_draft_pricing_hotels",
      model: "serpapi",
      estimatedCostGBP: 0.012,
      succeeded: hotels.fetch_error === null,
      errorMessage: hotels.fetch_error?.message ?? null,
    });
    if (isPioneer) {
      await logAiUsage({
        userId,
        tripId,
        feature: "lock_and_draft_pricing_flights",
        model: "serpapi",
        estimatedCostGBP: 0.012,
        succeeded: !!flights && !flights.fetch_error,
        errorMessage: flights?.fetch_error?.message ?? null,
      });
    }
  }
}
```

- [ ] **Step 4: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/lockAndDraft.ts
git commit -m "feat(lockAndDraft): SerpApi hotel for pro + flight for Pioneer in after() block"
```

---

## Task 16: `setBookingCustomUrl` action

**Files:**
- Create: `src/lib/actions/bookingUrl.ts`

- [ ] **Step 1: Implement**

Create `src/lib/actions/bookingUrl.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SetBookingUrlResult =
  | { success: true }
  | { success: false; error: string };

const MAX_URL_LENGTH = 2000;

function validateUrl(url: string | null): { ok: true; value: string | null } | { ok: false; error: string } {
  if (url === null) return { ok: true, value: null };
  const trimmed = url.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, error: "URL too long (max 2000 chars)." };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "URL not parseable." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "URL must be http or https." };
  }
  return { ok: true, value: trimmed };
}

export async function setBookingCustomUrl(
  bookingId: string,
  url: string | null,
): Promise<SetBookingUrlResult> {
  const validated = validateUrl(url);
  if (!validated.ok) return { success: false, error: validated.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: row } = await supabase
    .from("bookings")
    .select("trip_id, trip_members!inner(role, user_id)")
    .eq("id", bookingId)
    .eq("trip_members.user_id", user.id)
    .eq("trip_members.role", "admin")
    .maybeSingle<{ trip_id: string }>();

  if (!row) return { success: false, error: "Not authorised." };

  const { error } = await supabase
    .from("bookings")
    .update({ custom_url: validated.value })
    .eq("id", bookingId);
  if (error) {
    return { success: false, error: "Could not save URL." };
  }

  // Revalidate the trip overview cache.
  const { data: trip } = await supabase
    .from("trips")
    .select("slug")
    .eq("id", row.trip_id)
    .maybeSingle<{ slug: string }>();
  if (trip?.slug) revalidatePath(`/trips/${trip.slug}/bookings`);

  return { success: true };
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/bookingUrl.ts
git commit -m "feat(bookings): admin-only setBookingCustomUrl action with URL validation"
```

---

## Task 17: `PriceCellSummary` component

**Files:**
- Create: `src/components/overview/PriceCellSummary.tsx`

- [ ] **Step 1: Implement**

Create `src/components/overview/PriceCellSummary.tsx`:

```tsx
import type { LivePricing } from "@/lib/types";
import { currencySymbol } from "@/lib/currency";

type Kind = "flight" | "stay";
type Tier = "member" | "pioneer";

type Props = {
  kind: Kind;
  tier: Tier;
  livePricing: LivePricing | null | undefined;
  draftedAtIso: string | null;
};

const STALE_AFTER_MS = 60_000;

export function PriceCellSummary({ kind, tier, livePricing, draftedAtIso }: Props) {
  const draftedMs = draftedAtIso ? Date.parse(draftedAtIso) : null;
  const isStale = draftedMs !== null && Date.now() - draftedMs > STALE_AFTER_MS;
  const flights = livePricing?.flights;
  const hotels = livePricing?.hotels;

  if (kind === "flight") {
    if (tier === "member") return <span>Search flights →</span>;
    if (flights?.options && flights.options.length > 0 && !flights.fetch_error) {
      const sym = currencySymbol(flights.currency);
      return (
        <span>
          from {sym}
          {flights.options[0].price.amount.toLocaleString()} return →
        </span>
      );
    }
    if (flights?.fetch_error || isStale) return <span>Search flights →</span>;
    return <span className="text-fg-3">Pricing…</span>;
  }

  // kind === "stay"
  if (tier === "member") {
    if (hotels?.quotes && hotels.quotes.length > 0) {
      return <span>{hotels.quotes.length} picks · See on Booking.com →</span>;
    }
    return <span>Search hotels →</span>;
  }
  // tier === "pioneer"
  if (hotels?.quotes && hotels.quotes.length > 0 && !hotels.fetch_error) {
    const sym = currencySymbol(hotels.quotes[0].price_per_night.currency);
    return (
      <span>
        {hotels.quotes.length} picks · {sym}
        {hotels.quotes[0].price_per_night.amount.toLocaleString()}/nt →
      </span>
    );
  }
  if (hotels?.fetch_error || isStale) {
    return <span>Search hotels →</span>;
  }
  return <span className="text-fg-3">Pricing…</span>;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/overview/PriceCellSummary.tsx
git commit -m "feat(overview): PriceCellSummary with member/pioneer + 60s staleness fallback"
```

---

## Task 18: `FlightsSheet` component (Pioneer only)

**Files:**
- Create: `src/components/overview/FlightsSheet.tsx`

- [ ] **Step 1: Implement**

Create `src/components/overview/FlightsSheet.tsx`:

```tsx
"use client";

import { Dialog } from "@/components/ui/Dialog";
import type { FlightPricing } from "@/lib/types";
import { currencySymbol } from "@/lib/currency";

type Props = {
  open: boolean;
  onClose: () => void;
  flights: FlightPricing | null | undefined;
  fallbackDeeplink: string | null;
  refreshButton: React.ReactNode;
};

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

function fmtTime(iso: string): string {
  // SerpApi returns "YYYY-MM-DD HH:mm" — slice the time portion.
  const m = /\d{2}:\d{2}/.exec(iso);
  return m?.[0] ?? iso;
}

export function FlightsSheet({ open, onClose, flights, fallbackDeeplink, refreshButton }: Props) {
  const sym = flights ? currencySymbol(flights.currency) : "£";
  return (
    <Dialog open={open} onClose={onClose} title="Flights">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="label-sm text-fg-3">
          {flights ? `${flights.origin_iata} · ${flights.destination_iata}` : "—"}
        </p>
        {refreshButton}
      </div>
      <div className="grid gap-3 mt-4">
        {flights?.options?.length
          ? flights.options.map((opt, i) => (
              <a
                key={`${opt.airline}-${i}`}
                href={opt.deeplink || fallbackDeeplink || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-line bg-bg-2 p-4 flex items-center justify-between gap-3 hover:bg-bg-3"
              >
                <div className="flex items-center gap-3">
                  {opt.airline_logo_url && (
                    <img
                      src={opt.airline_logo_url}
                      alt=""
                      className="w-6 h-6 object-contain"
                    />
                  )}
                  <div>
                    <div className="font-medium">{opt.airline}</div>
                    <div className="text-fg-3 text-[12px]">
                      {fmtDuration(opt.duration_minutes)} · {opt.stops === 0 ? "Direct" : `${opt.stops} stop${opt.stops === 1 ? "" : "s"}`} · {fmtTime(opt.depart_iso)} → {fmtTime(opt.arrive_iso)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {sym}
                    {opt.price.amount.toLocaleString()}
                  </div>
                  <div className="text-fg-3 text-[11px]">Book →</div>
                </div>
              </a>
            ))
          : (
            <div className="border border-line p-6 text-fg-3 text-center">
              No live fares available. Try the search below.
            </div>
          )}
      </div>
      {fallbackDeeplink && (
        <a
          href={fallbackDeeplink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block text-center text-[13px] text-fg-3 hover:text-fg"
        >
          + See more on Google Flights →
        </a>
      )}
      {flights?.refreshed_at && (
        <p className="mt-3 label-sm text-fg-3 text-center">
          Last updated {new Date(flights.refreshed_at).toLocaleString()}
        </p>
      )}
    </Dialog>
  );
}
```

(Note: this assumes a `Dialog` primitive exists with `open`, `onClose`, `title` props per CLAUDE.md. If the actual prop names differ, adapt accordingly.)

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/overview/FlightsSheet.tsx
git commit -m "feat(overview): FlightsSheet — 3 fare options + fallback deeplink"
```

---

## Task 19: `StaySheet` component (all `pro` tiers)

**Files:**
- Create: `src/components/overview/StaySheet.tsx`

- [ ] **Step 1: Implement**

Create `src/components/overview/StaySheet.tsx`:

```tsx
"use client";

import { Dialog } from "@/components/ui/Dialog";
import type { HotelPricing } from "@/lib/types";
import { currencySymbol } from "@/lib/currency";

type Props = {
  open: boolean;
  onClose: () => void;
  hotels: HotelPricing | null | undefined;
  fallbackDeeplink: string;
  showPrices: boolean;          // false for Member tier
  refreshButton?: React.ReactNode; // Pioneer only
};

export function StaySheet({ open, onClose, hotels, fallbackDeeplink, showPrices, refreshButton }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="Stay">
      {refreshButton && (
        <div className="flex items-baseline justify-end mb-3">
          {refreshButton}
        </div>
      )}
      <div className="grid gap-3">
        {hotels?.quotes?.length
          ? hotels.quotes.map((h, i) => {
              const sym = currencySymbol(h.price_per_night.currency);
              return (
                <a
                  key={`${h.name}-${i}`}
                  href={h.deeplink || fallbackDeeplink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-line bg-bg-2 p-4 flex items-center gap-4 hover:bg-bg-3"
                >
                  {h.thumbnail_url ? (
                    <img
                      src={h.thumbnail_url}
                      alt=""
                      className="w-16 h-16 object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-bg-3" aria-hidden />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{h.name}</div>
                    {typeof h.rating === "number" && (
                      <div className="text-fg-3 text-[12px]">★ {h.rating.toFixed(1)}</div>
                    )}
                    {showPrices && (
                      <div className="text-[13px] mt-1">
                        {sym}
                        {h.price_per_night.amount.toLocaleString()}/nt · {sym}
                        {h.total_price.amount.toLocaleString()} total / room
                      </div>
                    )}
                  </div>
                  <div className="text-fg-3 text-[12px]">See →</div>
                </a>
              );
            })
          : (
            <div className="border border-line p-6 text-fg-3 text-center">
              No hotel picks available right now.
            </div>
          )}
      </div>
      <a
        href={fallbackDeeplink}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block text-center text-[13px] text-fg-3 hover:text-fg"
      >
        + See more on Booking.com →
      </a>
      {!showPrices && (
        <p className="mt-3 text-center text-[12px]">
          <a href="/account" className="text-accent hover:underline">
            Pioneer to see live prices →
          </a>
        </p>
      )}
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/overview/StaySheet.tsx
git commit -m "feat(overview): StaySheet for hotel picks (prices Pioneer-only)"
```

---

## Task 20: `RefreshPricesButton` three-state UI

**Files:**
- Modify: `src/components/overview/RefreshPricesButton.tsx`

- [ ] **Step 1: Read current file**

Read the existing file. Identify how it currently renders state.

- [ ] **Step 2: Implement three-state UI**

Replace the body of the component with:

```tsx
"use client";

import { useState, useTransition } from "react";
import { refreshPrices } from "@/lib/actions/priceRefresh";
import { useToast } from "@/hooks/useToast";

const RATE_LIMIT_HOURS = 4;

type Props = {
  userId: string;
  tripId: string;
  lastPriceRefreshAt: string | null;
  onRefreshed?: () => void;
};

function rateLimitCopy(lastIso: string | null): string | null {
  if (!lastIso) return null;
  const elapsedMs = Date.now() - Date.parse(lastIso);
  const remainingMs = RATE_LIMIT_HOURS * 3_600_000 - elapsedMs;
  if (remainingMs <= 0) return null;
  const h = Math.floor(remainingMs / 3_600_000);
  const m = Math.floor((remainingMs % 3_600_000) / 60_000);
  return h > 0 ? `Try in ${h}h ${m}m` : `Try in ${m}m`;
}

export function RefreshPricesButton({ userId, tripId, lastPriceRefreshAt, onRefreshed }: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [lastAt, setLastAt] = useState(lastPriceRefreshAt);
  const rateLimited = rateLimitCopy(lastAt);

  const handleClick = () => {
    if (pending || rateLimited) return;
    startTransition(async () => {
      const result = await refreshPrices(userId, tripId);
      if (result.success) {
        setLastAt(result.refreshedAt);
        toast.success("Prices refreshed.");
        onRefreshed?.();
      } else {
        toast.error(result.error);
      }
    });
  };

  let label: string;
  if (pending) label = "Refreshing…";
  else if (rateLimited) label = rateLimited;
  else label = "Refresh ↻";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending || !!rateLimited}
      className="label-sm-wide border border-line px-3 py-1.5 hover:bg-bg-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/overview/RefreshPricesButton.tsx
git commit -m "feat(refresh): three-state button respecting 4h rate limit"
```

---

## Task 21: BookingsList admin custom_url overflow menu

**Files:**
- Modify: `src/components/bookings/BookingsList.tsx`

- [ ] **Step 1: Add overflow menu for admin rows**

In the booking row, after the existing icon row, add an admin-only overflow:

```tsx
{isAdmin && (
  <button
    type="button"
    onClick={() => {
      const next = window.prompt("Custom booking URL (leave blank to clear):", b.custom_url ?? "");
      if (next === null) return;
      const value = next.trim() || null;
      startTransition(async () => {
        const res = await setBookingCustomUrl(b.id, value);
        if (!res.success) toast.error(res.error);
      });
    }}
    className="text-fg-3 hover:text-fg w-7 h-7 inline-flex items-center justify-center"
    aria-label={`Edit URL for ${b.title}`}
    title="Edit URL"
  >
    ✎
  </button>
)}
```

Add the import at the top:

```ts
import { setBookingCustomUrl } from "@/lib/actions/bookingUrl";
```

(Use the prompt-based UI as a v1 minimum; a richer dialog can come in a follow-up. The action itself validates URL safety.)

- [ ] **Step 2: Type-check + visual smoke**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

Run dev, sign in as a trip admin. Click ✎ on a booking row, paste a URL, confirm:
- Booking row shows `Book →` button (custom_url path) instead of 📍 + 🌐.
- Cleared via empty prompt → reverts to 📍 + 🌐.

- [ ] **Step 3: Commit**

```bash
git add src/components/bookings/BookingsList.tsx
git commit -m "feat(bookings): admin custom_url override via prompt + setBookingCustomUrl"
```

---

## Task 22: `EnrichedDraftView` — STAY cell, sheets, 60s phantom timeout

**Files:**
- Modify: `src/components/overview/EnrichedDraftView.tsx`

- [ ] **Step 1: Add imports + state**

Top of component:

```tsx
import { useState } from "react";
import { FlightsSheet } from "./FlightsSheet";
import { StaySheet } from "./StaySheet";
import { PriceCellSummary } from "./PriceCellSummary";
import { RefreshPricesButton } from "./RefreshPricesButton";

// In Props: add isPioneer + userId + tripId + lastPriceRefreshAt + draftedAt
```

Add to props:

```ts
isPioneer: boolean;
userId: string;
tripId: string;
lastPriceRefreshAt: string | null;
```

Inside the component body:

```tsx
const [flightsSheetOpen, setFlightsSheetOpen] = useState(false);
const [staySheetOpen, setStaySheetOpen] = useState(false);
const tier = isPioneer ? "pioneer" as const : "member" as const;
```

- [ ] **Step 2: Update the FLIGHTS spec-grid cell**

Find where the FLIGHTS cell renders `flightSearchUrl`. Replace its sub-line + click-handler:

```tsx
<button
  type="button"
  onClick={(e) => {
    if (tier === "pioneer" && livePricing?.flights?.options?.length) {
      e.preventDefault();
      setFlightsSheetOpen(true);
    } else {
      window.open(draft.flightSearchUrl, "_blank", "noopener,noreferrer");
    }
  }}
  className="text-left"
>
  <PriceCellSummary
    kind="flight"
    tier={tier}
    livePricing={livePricing}
    draftedAtIso={generatedAt}
  />
</button>
```

- [ ] **Step 3: Add the STAY cell**

Find the spec-grid 4-cell renderer. Replace the cell formerly used for "THE RULE" with a conditional STAY cell when hotels exist, else fall back to THE RULE. Pseudocode:

```tsx
{livePricing?.hotels?.quotes && livePricing.hotels.quotes.length > 0 ? (
  <button
    type="button"
    onClick={() => setStaySheetOpen(true)}
    className="text-left"
  >
    <PriceCellSummary
      kind="stay"
      tier={tier}
      livePricing={livePricing}
      draftedAtIso={generatedAt}
    />
  </button>
) : (
  <span>{theRuleSubLine}</span>
)}
```

(Replace `theRuleSubLine` with whatever the existing code renders for THE RULE.)

- [ ] **Step 4: Render the sheets**

At the end of the component's JSX:

```tsx
<FlightsSheet
  open={flightsSheetOpen}
  onClose={() => setFlightsSheetOpen(false)}
  flights={livePricing?.flights}
  fallbackDeeplink={draft.flightSearchUrl}
  refreshButton={
    isPioneer ? (
      <RefreshPricesButton
        userId={userId}
        tripId={tripId}
        lastPriceRefreshAt={lastPriceRefreshAt}
      />
    ) : null
  }
/>
<StaySheet
  open={staySheetOpen}
  onClose={() => setStaySheetOpen(false)}
  hotels={livePricing?.hotels}
  fallbackDeeplink={
    `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(draft.destination)}&checkin=${draft.itinerary[0]?.date ?? ""}&checkout=${draft.itinerary.at(-1)?.date ?? ""}`
  }
  showPrices={isPioneer}
  refreshButton={
    isPioneer ? (
      <RefreshPricesButton
        userId={userId}
        tripId={tripId}
        lastPriceRefreshAt={lastPriceRefreshAt}
      />
    ) : null
  }
/>
```

- [ ] **Step 5: Update the call-site to pass new props**

In whatever renders `<EnrichedDraftView ... />`, pass:
- `isPioneer={await isPioneerForTrip(userId, tripId)}` (resolve in the parent server component)
- `userId`, `tripId`
- `lastPriceRefreshAt={trip.last_price_refresh_at}`

Look for `EnrichedDraftView` callers and update each.

- [ ] **Step 6: Type-check + visual smoke**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

Run dev. As a Member: FLIGHTS cell shows `Search flights →`, STAY cell shows `N picks · See on Booking.com →`. Click STAY → sheet shows hotel cards without prices, with "Pioneer to see live prices →" link. As a Pioneer: cells show prices; sheets show prices + Refresh button.

- [ ] **Step 7: Commit**

```bash
git add src/components/overview/EnrichedDraftView.tsx <other-callsite-files>
git commit -m "feat(overview): wire STAY cell + sheets + tier-aware pricing rendering"
```

---

## Task 23: Document env vars + ship gate

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Document new env vars**

Append to `.env.example`:

```
# Optional: monthly cap for SerpApi spend (GBP). When the sum of
# ai_usage entries with feature like "serpapi_%" or
# "lock_and_draft_pricing_%" reaches this in the current calendar
# month, all new SerpApi calls degrade to deeplinks.
SERPAPI_MONTHLY_CAP_GBP=50
```

(`SERPAPI_KEY` is already documented elsewhere if the existing client uses it. If not, add `SERPAPI_KEY=` with a comment.)

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(env): SERPAPI_MONTHLY_CAP_GBP for live pricing cap"
```

---

## Phase 2 Ship Gate

- [ ] **Step 1: Type-check, build, full test run**

```bash
pnpm exec tsc --noEmit
pnpm build
pnpm test:setup
pnpm test
```
All must pass.

- [ ] **Step 2: Stage soak — preview deploy with `SERPAPI_KEY` set**

In Vercel preview env, set `SERPAPI_KEY` and `SERPAPI_MONTHLY_CAP_GBP=10`. Leave production without `SERPAPI_KEY` so live pricing stays off until soak passes.

Lock & Draft on three preview test trips:
- Stockholm (Pioneer admin)
- Lisbon (Member admin)
- Marrakesh (Pioneer admin)

After each draft, verify by SQL:
- `select meta->'live_pricing'->'hotels'->'quotes' from trips where slug = '...'` returns 1–3 hotel objects with names + prices for both Member and Pioneer trips.
- `select meta->'live_pricing'->'flights'->'options' from trips where slug = '...'` returns 3 fare objects ONLY for the Pioneer trips.

- [ ] **Step 3: Force a SerpApi failure to confirm fallback**

Temporarily set `SERPAPI_KEY=invalid` in preview, Lock & Draft a fresh trip. Verify:
- `meta.live_pricing.hotels.fetch_error` is populated.
- Overview FLIGHTS cell falls back to `Search flights →`.
- Overview STAY cell falls back to `Search hotels →`.
- No console crash.

Reset `SERPAPI_KEY` to the real value.

- [ ] **Step 4: Test airplane-mode (after() interruption resilience)**

In a preview trip, hard-stop the function mid-draft (or just observe an existing draft with `live_pricing` empty for > 60s). Confirm UI doesn't show `Pricing…` indefinitely — falls back to deeplinks at the 60s mark.

- [ ] **Step 5: Cost telemetry sanity check**

Hit `/ai-usage`. Confirm the new `serpapi_*` and `lock_and_draft_pricing_*` rows appear with non-zero `estimated_cost_gbp`. Sum for the day < $1.

- [ ] **Step 6: Manual QA on regeneration preserving custom_url**

On a preview trip:
1. Set a `custom_url` on one ai_drafted booking via the new ✎ admin button (Task 21).
2. Re-run Lock & Draft.
3. Verify the booking still has the custom_url AND the AI's new place_id/maps_url for the same title.

- [ ] **Step 7: Set `SERPAPI_KEY` in production**

Once preview soak is clean for 24h:
- Set `SERPAPI_KEY` and `SERPAPI_MONTHLY_CAP_GBP` in Vercel production env.
- Trigger a no-op redeploy.
- Watch `/ai-usage` for the first day of real traffic.

---

## Self-Review Notes

This plan covers the spec sections:
- Section 1 (data model) → Tasks 1, 9
- Section 2 Step A (AI emits structured names) → Task 4
- Section 2 Step B (Places resolution) → Tasks 2, 5
- Section 2 Step C (hotels for all pro) → Tasks 11, 15
- Section 2 Step D (flights for Pioneer) → Tasks 12, 13, 15
- Section 2 Step E (telemetry) → Tasks 10, 15 (logAiUsage in lockAndDraft)
- Section 2.5 (reliability — 5 items + base) → Tasks 2, 5, 10, 14, 15, 17, 22
- Section 3 (UI surfaces) → Tasks 6, 7, 8, 17, 18, 19, 20, 21, 22
- Section 4 (server actions) → Tasks 14, 16
- Section 5 (rollout) → Phase 1 + Phase 2 ship gates

Spec coverage gaps to flag during execution:
- The plan does not introduce a `meta.draft_progress` `places_partial` / `pricing_failed` soft-warning state. The existing progress shape is preserved; the mechanism to surface "places partially missed" is logging only. Acceptable v1 — UI surfacing of these warnings is a follow-up.
- Task 5 implements **exact lowercase title match** for booking-snapshot preservation, not the spec's Levenshtein-≤-2 fuzzy match. The exact match catches the common case where AI repeats a title verbatim. Levenshtein is a Task 5b follow-up if regeneration drift becomes a real problem in QA.
- The plan uses a simple `window.prompt` for the admin custom_url editor (Task 21). A richer dialog is a follow-up.
