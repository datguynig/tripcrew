# Founding Crew M0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Handoff target: Codex.** This plan must be self-contained — Codex has not seen the conversation that produced it. Every file path, code block, and acceptance criterion is required.

**Goal:** Ship the M0 Founding Crew deliverables — founder badge in-app, public `/founders` wall, grandfathered-pricing flag — so paying founders get a visibly differentiated experience the moment their subscription clears.

**Architecture:** Single migration adds one nullable column (`profiles.pricing_grandfathered_at`). The Stripe webhook already stamps `founding_crew_at` on Founding checkout; we extend the same write to also stamp the new column. A tiny `FounderBadge` primitive renders in three surfaces: crew chat (`MessageBubble` + `Gallery`), `/account` subscription panel, and the new public `/founders` page. The crew chat author lookup currently shapes as `Record<string, string>` (just the name) — we widen it to `{ name, isFounder }` and update three rendering sites. The `/founders` page is a Server Component that reads from the service-role client, ordered by `founding_crew_at DESC`.

**Tech Stack:**
- Next.js 16 App Router, RSC by default
- Supabase Postgres + service-role client
- Tailwind CSS v4 with tokens defined under `@theme` in `src/app/globals.css`
- Tests: `node:test` via `tsx --test path/to/test.ts` (existing convention — see `src/lib/stripe/__tests__/webhookCheckout.test.ts`)
- Verification: `pnpm build` for Next type-check, `pnpm test` for Playwright smoke + a11y

**Pre-existing in scope** (do not rebuild):
- `profiles.founding_crew_at` column (migration `20260429000200_founding_crew_flag.sql`) — stamped by webhook
- `getFoundingCrewRemaining()` in `src/lib/pricing/foundingCount.ts` — already powers the landing counter
- `PricingReveal` and `Hero` already render the live `X of 500 seats remain` chip
- `Profile` type in `src/lib/types.ts` already has `founding_crew_at: string | null`

**Out of scope for M0** (do not add):
- M1 features: conversational AI, roadmap voting (separate plans)
- Founders-wall opt-out toggle (M0.1 if a founder requests it post-launch)
- Crew Plus annual `£79/yr` checkout (separate Patch 2 plan)
- HowItWorks step 03 "memory book" copy fix (separate Patch 1 — one line edit)

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/20260430000400_pricing_grandfathered.sql` | Create | Add nullable `profiles.pricing_grandfathered_at timestamptz` + partial index |
| `src/lib/types.ts` | Modify | Add `pricing_grandfathered_at: string \| null` to `Profile` |
| `src/app/api/stripe/webhook/route.ts` | Modify | Stamp `pricing_grandfathered_at` alongside `founding_crew_at` |
| `src/lib/stripe/__tests__/webhook.foundingPriceLock.test.ts` | Create | Unit-test the dual-stamp behaviour |
| `src/components/ui/FounderBadge.tsx` | Create | Tiny coral pill: `★ FOUNDER`, mono uppercase, three sizes |
| `src/app/(app)/trips/[slug]/feed/page.tsx` | Modify | Widen authorsById select + map shape |
| `src/components/feed/Feed.tsx` | Modify | Update `CrewMap` type + pass through |
| `src/components/feed/MessageBubble.tsx` | Modify | Render badge next to authorName |
| `src/components/feed/Gallery.tsx` | Modify | Render badge in author chips + photo cards |
| `src/components/account/SubscriptionPanel.tsx` | Modify | Render badge in the founder branch of the panel |
| `src/app/(public)/founders/page.tsx` | Create | Public reverse-chrono founders wall |
| `src/components/marketing/FoundersWall.tsx` | Create | Presentational component for the wall |

---

## Task 1: Schema — `pricing_grandfathered_at` column

**Files:**
- Create: `supabase/migrations/20260430000400_pricing_grandfathered.sql`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260430000400_pricing_grandfathered.sql`:

```sql
-- 20260430000400_pricing_grandfathered.sql
-- Stamps the moment a founder's price was locked in. Read by future
-- post-cohort pricing logic so Founding Crew members keep £179/yr
-- after the cohort closes and Crew Concierge launches at £29/mo for
-- new buyers. Stripe webhook writes this at the same moment it writes
-- founding_crew_at. Nullable so existing rows are unaffected.

alter table profiles add column pricing_grandfathered_at timestamptz;

create index profiles_pricing_grandfathered_idx
  on profiles(pricing_grandfathered_at)
  where pricing_grandfathered_at is not null;
```

- [ ] **Step 2: Apply the migration locally**

Run: `pnpm supabase migration up` (or whatever the project's migration command is — check `README.md` if unsure)

Expected: column added; no errors.

- [ ] **Step 3: Update the Profile type**

In `src/lib/types.ts`, locate the `Profile` type. Currently the relevant lines are:

```ts
  is_founder: boolean;
  founding_crew_at: string | null;
```

Replace with:

```ts
  is_founder: boolean;
  founding_crew_at: string | null;
  pricing_grandfathered_at: string | null;
```

- [ ] **Step 4: Verify type-check**

Run: `pnpm build` (or `pnpm tsc --noEmit` if a typecheck script exists)
Expected: clean build. Any callsite that destructures Profile and now misses the new field is fine because it's nullable, not required at construction.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260430000400_pricing_grandfathered.sql src/lib/types.ts
git commit -m "feat(schema): add profiles.pricing_grandfathered_at"
```

---

## Task 2: Webhook stamps `pricing_grandfathered_at`

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts`
- Create: `src/lib/stripe/__tests__/webhook.foundingPriceLock.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/stripe/__tests__/webhook.foundingPriceLock.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

// This test asserts behaviour that lives in route.ts. We extract the
// founding-stamp branch into a helper to make it testable.
import { applyFoundingStamps } from "@/lib/stripe/foundingStamps";

test("applyFoundingStamps stamps both founding_crew_at and pricing_grandfathered_at when null", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const supabase = {
    from() {
      return {
        update(payload: Record<string, unknown>) {
          updates.push(payload);
          return {
            eq() {
              return {
                is() {
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  await applyFoundingStamps(supabase as never, "profile-1");

  assert.equal(updates.length, 1);
  assert.ok(updates[0].founding_crew_at);
  assert.ok(updates[0].pricing_grandfathered_at);
  assert.equal(
    typeof updates[0].founding_crew_at,
    typeof updates[0].pricing_grandfathered_at,
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `tsx --test src/lib/stripe/__tests__/webhook.foundingPriceLock.test.ts`
Expected: FAIL with "Cannot find module '@/lib/stripe/foundingStamps'"

- [ ] **Step 3: Create the helper**

Create `src/lib/stripe/foundingStamps.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

// Stamps the founding-crew-at and pricing-grandfathered-at columns
// in a single update. Both stamps are written together so the
// price-lock guarantee is created at the same moment the founding
// status is recorded — there is no window where a profile is a
// founder but not price-locked.
export async function applyFoundingStamps(
  supabase: SupabaseClient,
  profileId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      founding_crew_at: now,
      pricing_grandfathered_at: now,
    })
    .eq("id", profileId)
    .is("founding_crew_at", null);

  if (error) {
    console.error("stripe webhook: founding stamps update failed:", error);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `tsx --test src/lib/stripe/__tests__/webhook.foundingPriceLock.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the helper into the webhook**

In `src/app/api/stripe/webhook/route.ts`, locate this block (around lines 165–175):

```ts
  const foundingPriceId = process.env.STRIPE_FOUNDING_PRICE_ID;
  if (foundingPriceId) {
    const priceId = sub.items.data[0]?.price?.id;
    if (priceId === foundingPriceId) {
      const { error: foundingErr } = await supabase
        .from("profiles")
        .update({ founding_crew_at: new Date().toISOString() })
        .eq("id", profileId)
        .is("founding_crew_at", null);
      if (foundingErr) {
        console.error(
          "stripe webhook: founding_crew_at update failed:",
          foundingErr,
        );
      }
    }
  }
```

Replace with:

```ts
  const foundingPriceId = process.env.STRIPE_FOUNDING_PRICE_ID;
  if (foundingPriceId) {
    const priceId = sub.items.data[0]?.price?.id;
    if (priceId === foundingPriceId) {
      const { applyFoundingStamps } = await import(
        "@/lib/stripe/foundingStamps"
      );
      await applyFoundingStamps(supabase, profileId);
    }
  }
```

The dynamic import is intentional: keeps the webhook hot path lean and matches existing patterns in the file.

- [ ] **Step 6: Verify same-named callsite in `src/lib/auth/checkoutProvisioning.ts`**

Open `src/lib/auth/checkoutProvisioning.ts`. Locate the lines that set `founding_crew_at` (around lines 75–95). Wherever `founding_crew_at = new Date().toISOString()` is assigned to a payload, add the sibling assignment `pricing_grandfathered_at: new Date().toISOString()` right after it. There should be two callsites (one update branch, one insert branch). Both must change.

For example, if the existing update branch reads:

```ts
    if (params.isFoundingMember && !existingProfile.founding_crew_at) {
      updatePayload.founding_crew_at = new Date().toISOString();
    }
```

Replace with:

```ts
    if (params.isFoundingMember && !existingProfile.founding_crew_at) {
      const stampedAt = new Date().toISOString();
      updatePayload.founding_crew_at = stampedAt;
      updatePayload.pricing_grandfathered_at = stampedAt;
    }
```

And for the insert branch, similarly assign both fields.

- [ ] **Step 7: Run the full unit suite**

Run: `tsx --test src/lib/stripe/__tests__/webhookCheckout.test.ts src/lib/stripe/__tests__/webhook.foundingPriceLock.test.ts`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/stripe/foundingStamps.ts src/lib/stripe/__tests__/webhook.foundingPriceLock.test.ts src/app/api/stripe/webhook/route.ts src/lib/auth/checkoutProvisioning.ts
git commit -m "feat(stripe): stamp pricing_grandfathered_at alongside founding_crew_at"
```

---

## Task 3: `FounderBadge` UI primitive

**Files:**
- Create: `src/components/ui/FounderBadge.tsx`

The badge is rendered in three surfaces (crew chat, account, founders wall) at different sizes. Single component, three size variants. Voice and palette match `designsystem.md` §2 — coral accent, mono uppercase, no rounded corners.

- [ ] **Step 1: Create the component**

Create `src/components/ui/FounderBadge.tsx`:

```tsx
type Size = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-[18px] px-1.5 text-[9px]",
  md: "h-[22px] px-2 text-[10px]",
  lg: "h-[28px] px-2.5 text-[11px]",
};

export function FounderBadge({
  size = "sm",
  className = "",
}: {
  size?: Size;
  className?: string;
}) {
  return (
    <span
      aria-label="Founding Crew member"
      title="Founding Crew member"
      className={[
        "inline-flex items-center gap-1 font-mono uppercase tracking-[0.18em] whitespace-nowrap",
        "bg-marketing-coral text-ink",
        SIZE_CLASSES[size],
        className,
      ].join(" ")}
    >
      <span aria-hidden="true">★</span>
      <span>Founder</span>
    </span>
  );
}
```

- [ ] **Step 2: Verify it renders by adding a temporary import to a known page**

Skip — verification is done implicitly when Tasks 4–7 import it.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/FounderBadge.tsx
git commit -m "feat(ui): add FounderBadge primitive"
```

---

## Task 4: Widen the crew chat authorsById map

**Files:**
- Modify: `src/app/(app)/trips/[slug]/feed/page.tsx`
- Modify: `src/components/feed/Feed.tsx`

The current shape is `Record<string, string>` (user id → display name). We widen to `Record<string, { name: string; isFounder: boolean }>` so MessageBubble can render the badge without a second round-trip.

- [ ] **Step 1: Update the feed page select**

In `src/app/(app)/trips/[slug]/feed/page.tsx`, locate this query (around line 34):

```ts
      .select("user_id, profiles!trip_members_user_id_fkey(name)")
```

Replace with:

```ts
      .select(
        "user_id, profiles!trip_members_user_id_fkey(name, founding_crew_at)",
      )
```

And the map-build block immediately below (around lines 47–52):

```ts
  const authorsById: Record<string, string> = {};
  membersResult.data?.forEach((row) => {
    const profile = Array.isArray(row.profiles)
      ? row.profiles[0]
      : (row.profiles as { name?: string } | null);
    if (profile?.name) authorsById[row.user_id] = profile.name;
  });
```

Replace with:

```ts
  const authorsById: Record<
    string,
    { name: string; isFounder: boolean }
  > = {};
  membersResult.data?.forEach((row) => {
    const profile = Array.isArray(row.profiles)
      ? row.profiles[0]
      : (row.profiles as {
          name?: string;
          founding_crew_at?: string | null;
        } | null);
    if (profile?.name) {
      authorsById[row.user_id] = {
        name: profile.name,
        isFounder: !!profile.founding_crew_at,
      };
    }
  });
```

- [ ] **Step 2: Update CrewMap type in Feed**

In `src/components/feed/Feed.tsx`, find the `CrewMap` type (search for `CrewMap`). It currently is:

```ts
type CrewMap = Record<string, string>;
```

Replace with:

```ts
type CrewMap = Record<string, { name: string; isFounder: boolean }>;
```

- [ ] **Step 3: Update the authorName lookup callsites in Feed**

Find every read of `authorsById[…]` in `src/components/feed/Feed.tsx`. There are at least three (line ~359 and ~464–465 from prior grep). The shape change means each `authorsById[id]` no longer returns a string. Update the resolution helper. At the top of the file, add:

```ts
const UNKNOWN_AUTHOR = { name: "Unknown", isFounder: false };

function resolveAuthor(
  authorsById: CrewMap,
  id: string,
): { name: string; isFounder: boolean } {
  return authorsById[id] ?? UNKNOWN_AUTHOR;
}
```

Then each callsite:

```ts
authorName: authorsById[post.author_id] ?? "Unknown",
```

becomes:

```ts
authorName: resolveAuthor(authorsById, post.author_id).name,
authorIsFounder: resolveAuthor(authorsById, post.author_id).isFounder,
```

And the gallery-author-list builder (around lines 464–469):

```ts
      if (!seen.has(p.author_id)) {
        seen.set(p.author_id, authorsById[p.author_id] ?? "Unknown");
      }
```

becomes:

```ts
      if (!seen.has(p.author_id)) {
        seen.set(p.author_id, resolveAuthor(authorsById, p.author_id));
      }
```

The downstream `seen` map's value type changes from `string` to `{ name; isFounder }`. Update its declaration accordingly:

```ts
const seen = new Map<string, { name: string; isFounder: boolean }>();
```

And the consuming JSX that reads `.name` instead of the bare string.

- [ ] **Step 4: Verify type-check**

Run: `pnpm build`
Expected: clean. Any TS error here means a callsite was missed — fix before moving on.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/trips/\[slug\]/feed/page.tsx src/components/feed/Feed.tsx
git commit -m "refactor(feed): widen authorsById to carry founder status"
```

---

## Task 5: Render `FounderBadge` in MessageBubble + Gallery

**Files:**
- Modify: `src/components/feed/MessageBubble.tsx`
- Modify: `src/components/feed/Gallery.tsx`

- [ ] **Step 1: Update MessageBubble props**

In `src/components/feed/MessageBubble.tsx`, find the props type (line ~10):

```ts
  authorName: string;
```

Add right below it:

```ts
  authorName: string;
  authorIsFounder?: boolean;
```

- [ ] **Step 2: Render the badge next to authorName**

Locate the rendering of the author name (line ~292):

```tsx
            <span className="subheading text-fg">{authorName}</span>
```

Replace with:

```tsx
            <span className="subheading text-fg inline-flex items-center gap-2">
              {authorName}
              {authorIsFounder ? <FounderBadge size="sm" /> : null}
            </span>
```

Add the import at the top of the file:

```tsx
import { FounderBadge } from "@/components/ui/FounderBadge";
```

- [ ] **Step 3: Pass authorIsFounder from Feed to MessageBubble**

In `src/components/feed/Feed.tsx`, find the `<MessageBubble />` render (the spread that includes `authorName={...}`). Add the new prop alongside:

```tsx
authorIsFounder={resolveAuthor(authorsById, post.author_id).isFounder}
```

Don't forget the reply-quote branch — `replyPreview.authorName` should also surface the badge if the quoted author is a founder. Locate the `replyPreview` builder (search for `replyPreview` in Feed.tsx). Widen its type:

```ts
replyPreview: { authorName: string; authorIsFounder: boolean; excerpt: string } | null;
```

And in `MessageBubble.tsx`, line ~16:

```ts
  replyPreview: { authorName: string; excerpt: string } | null;
```

becomes:

```ts
  replyPreview: { authorName: string; authorIsFounder: boolean; excerpt: string } | null;
```

And line ~94, where the reply-quote header renders:

```tsx
      <span className="label-xs text-fg-3">Replying to {authorName}</span>
```

becomes:

```tsx
      <span className="label-xs text-fg-3 inline-flex items-center gap-1.5">
        Replying to {authorName}
        {authorIsFounder ? <FounderBadge size="sm" /> : null}
      </span>
```

(`authorName` and `authorIsFounder` here come from the inner `ReplyPreview` component's destructured props — update that component's signature to accept `authorIsFounder: boolean` too.)

- [ ] **Step 4: Update Gallery**

In `src/components/feed/Gallery.tsx`, locate the `authors` prop type (line ~15):

```ts
  authors: Array<{ id: string; name: string }>;
```

Replace with:

```ts
  authors: Array<{ id: string; name: string; isFounder: boolean }>;
```

Find the photo-card `authorName` render (line ~234):

```tsx
            {initials(authorName)}
```

That's the avatar. Find the actual visible author name in the same component. There's a label that uses `authorName` (search for `authorName` in Gallery.tsx). At each visible label, conditionally render `<FounderBadge size="sm" />` after the name.

Update Gallery's `Photo`-row props to include `authorIsFounder: boolean`. Pass it from the `posts.map(...)` that renders rows (line ~120 area):

```tsx
authorIsFounder={authorsById[p.author_id]?.isFounder ?? false}
```

(Note: `authorsById` in Gallery already takes the new shape since Task 4 changed `CrewMap`. The lookup `authorsById[p.author_id] ?? "Unknown"` was previously a string; it's now `{ name, isFounder } | undefined`. Update Gallery's reads accordingly.)

Add the import:

```tsx
import { FounderBadge } from "@/components/ui/FounderBadge";
```

- [ ] **Step 5: Verify build**

Run: `pnpm build`
Expected: clean.

- [ ] **Step 6: Manual smoke**

Start dev server: `pnpm dev`
Sign in as the founder account `nigelattamensah@gmail.com`. Visit any trip's `/feed` and post a message. Verify the `★ FOUNDER` badge appears next to the author name. Check both the message author header and a reply-quote header.

If the badge does not appear: confirm `profiles.founding_crew_at` is non-null for that user (`select id, founding_crew_at from profiles where id = '...'`). If null, stamp it manually for testing: `update profiles set founding_crew_at = now(), pricing_grandfathered_at = now() where id = '...';`

- [ ] **Step 7: Commit**

```bash
git add src/components/feed/MessageBubble.tsx src/components/feed/Gallery.tsx src/components/feed/Feed.tsx
git commit -m "feat(feed): render FounderBadge next to founder author names"
```

---

## Task 6: Render badge on `/account`

**Files:**
- Modify: `src/components/account/SubscriptionPanel.tsx`

The account panel branches on subscription status. The founder branch (or wherever `profile.founding_crew_at` is non-null) should render the badge prominently — this is the "you are a founder, here's your visible status" surface.

- [ ] **Step 1: Open the panel and find the founder branch**

Open `src/components/account/SubscriptionPanel.tsx`. Find any branch that already references `founding_crew_at`. If none exists yet, the panel currently treats founders identically to Crew Plus.

- [ ] **Step 2: Add the founder branch**

At the top of the panel's main return, before any tier-specific branching, add:

```tsx
{profile.founding_crew_at ? (
  <div className="mb-6 flex items-center gap-3 border border-line bg-bg-2 px-5 py-4">
    <FounderBadge size="lg" />
    <div className="flex flex-col">
      <span className="text-[14px] text-fg leading-[1.3]">
        You are a Founding Crew member.
      </span>
      <span className="text-[12px] text-fg-3 leading-[1.3]">
        Price-locked at £179/yr for life. Joined{" "}
        {new Date(profile.founding_crew_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        .
      </span>
    </div>
  </div>
) : null}
```

Add the import:

```tsx
import { FounderBadge } from "@/components/ui/FounderBadge";
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: clean.

- [ ] **Step 4: Manual smoke**

Sign in as a founder account, visit `/account`. Verify the badge + price-lock copy renders at the top of the subscription panel.

- [ ] **Step 5: Commit**

```bash
git add src/components/account/SubscriptionPanel.tsx
git commit -m "feat(account): surface founding-crew badge + price-lock copy"
```

---

## Task 7: Public `/founders` wall

**Files:**
- Create: `src/app/(public)/founders/page.tsx`
- Create: `src/components/marketing/FoundersWall.tsx`

Public, no auth. Lists all `profiles.founding_crew_at IS NOT NULL` reverse-chronologically (newest founders first — matches the brand's "active cohort" feel). Each row: founder number (assigned by sort position from the oldest founder = №001), display name, joined date.

- [ ] **Step 1: Create the data-fetching page**

Create `src/app/(public)/founders/page.tsx`:

```tsx
import { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { FoundersWall } from "@/components/marketing/FoundersWall";
import { FOUNDING_CREW_LIMIT } from "@/lib/pricing/foundingCount";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Founding Crew · Tripcrew",
  description:
    "The 500 founding members shaping Tripcrew. Price-locked for life.",
};

type FounderRow = {
  id: string;
  name: string | null;
  founding_crew_at: string;
};

export default async function FoundersPage() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, founding_crew_at")
    .not("founding_crew_at", "is", null)
    .order("founding_crew_at", { ascending: true })
    .returns<FounderRow[]>();

  if (error) {
    console.error("/founders: profiles query failed:", error);
  }

  const founders = (data ?? []).map((row, index) => ({
    number: index + 1,
    name: row.name,
    joinedAt: row.founding_crew_at,
  }));

  return (
    <FoundersWall founders={founders} totalSeats={FOUNDING_CREW_LIMIT} />
  );
}
```

- [ ] **Step 2: Create the presentational wall**

Create `src/components/marketing/FoundersWall.tsx`:

```tsx
import Link from "next/link";
import { RevealOnView } from "@/components/motion";

type Founder = {
  number: number;
  name: string | null;
  joinedAt: string;
};

export function FoundersWall({
  founders,
  totalSeats,
}: {
  founders: Founder[];
  totalSeats: number;
}) {
  const claimed = founders.length;
  const remaining = Math.max(0, totalSeats - claimed);
  const reverseOrder = [...founders].reverse();

  return (
    <section className="bg-cream text-ink min-h-screen">
      <div className="mx-auto max-w-[1080px] px-6 sm:px-10 py-24 md:py-32">
        <RevealOnView className="flex flex-col gap-6 mb-20">
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
            The Founding Crew
          </p>
          <h1 className="font-serif text-[56px] md:text-[88px] leading-[0.95] tracking-[-0.025em] max-w-[18ch]">
            The {claimed}{" "}
            <span className="font-serif italic">building it with us.</span>
          </h1>
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-ink/65">
            {remaining} of {totalSeats} seats remain ·{" "}
            <Link
              href="/apply?intent=founding"
              className="text-marketing-coral-deep underline underline-offset-4 hover:no-underline"
            >
              claim a spot →
            </Link>
          </p>
        </RevealOnView>

        {claimed === 0 ? (
          <p className="font-serif text-[24px] italic text-ink/60">
            The first founder hasn&apos;t joined yet. Be №001.
          </p>
        ) : (
          <ol className="border-t-2 border-ink">
            {reverseOrder.map((founder) => (
              <li
                key={founder.number}
                className="grid grid-cols-[80px_1fr_auto] gap-6 md:gap-12 items-baseline py-5 border-b border-ink/15"
              >
                <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-marketing-coral-deep">
                  №{String(founder.number).padStart(3, "0")}
                </span>
                <span className="font-serif text-[22px] md:text-[28px] leading-[1.2]">
                  {founder.name ?? "Anonymous founder"}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
                  {new Date(founder.joinedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: clean. The new route should appear in the build output.

- [ ] **Step 4: Manual smoke**

Visit `http://localhost:3000/founders` (signed out is fine — public route). Verify:
- Empty state copy ("Be №001") if no founders exist yet, OR
- The list renders reverse-chronologically with numbers ascending from oldest = №001
- The `X of 500 seats remain` line matches the landing-page counter
- The CTA link points to `/apply?intent=founding`

- [ ] **Step 5: Add to landing page footer**

Open `src/components/marketing/Footer.tsx` (or wherever the public footer lives — search if needed). Add a link to `/founders` in the appropriate column. If the file does not exist, skip — a separate task can wire footer navigation.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(public\)/founders/page.tsx src/components/marketing/FoundersWall.tsx
git commit -m "feat(marketing): add public /founders wall"
```

---

## Task 8: Self-review

- [ ] **Step 1: Verify all M0 promises are addressed**

Open `roadmap.md`. The "Required at launch (Month 0)" table has five rows:

| Roadmap row | Addressed by |
|---|---|
| Founder badge in app | Tasks 3, 5, 6 |
| Founders wall (page listing all 500) | Task 7 |
| Lifetime price-lock + grandfathered pricing | Tasks 1, 2 |
| `47/500 LEFT` live counter on landing page | Already shipped (no work needed) |
| Stripe webhook updates Founding Crew count | Already shipped (no work needed) |

All addressed.

- [ ] **Step 2: Update the roadmap status**

In `roadmap.md`, flip the three M0 rows from 📋 to ✅, add the date 2026-04-30 and a brief note (e.g. "shipped in plan founding-crew-m0"). The "live counter" and "webhook updates count" rows were already shipped — leave them.

- [ ] **Step 3: Update the Honesty audit**

In `roadmap.md`, the "Founding Crew — 0 of 7 public claims shipped" section now becomes "1 of 7 — Founder badge / founders wall" (counted as one row on the tier card). Update the Status column for the relevant rows.

- [ ] **Step 4: Run the full Playwright suite**

Run: `pnpm test`
Expected: all smoke + a11y tests pass. If any fail because they assumed the old `authorsById` shape, fix the test, not the production code.

- [ ] **Step 5: Final commit**

```bash
git add roadmap.md
git commit -m "docs(roadmap): mark Founding Crew M0 deliverables shipped"
```

---

## Risks / things Codex should pause on

- **Shape change in `CrewMap` is the highest-risk refactor** in this plan. There may be more callsites than the three I identified. `pnpm build` will catch them — do not silence type errors, fix them.
- **Migration ordering**: if another migration with a higher timestamp has already been added by the time this plan runs, bump the `20260430000400` prefix accordingly so the new file remains last in the directory.
- **Founders wall privacy**: this surfaces real names publicly. Confirmed acceptable for M0 because Founding Crew membership is itself a public-facing benefit on the tier card. If a founder requests anonymisation, M0.1 adds a `display_on_founders_wall` opt-out — out of scope here.
- **`createServiceClient` on a public route**: only used to read non-PII (name + joined_at) for founders. Do not extend the select to include any other column without re-reviewing.
- **Manual smoke** in Tasks 5, 6, 7 requires a profile with `founding_crew_at` non-null. If the dev DB has no such row, stamp one manually as instructed in Task 5 Step 6.

---

## Acceptance criteria (post-implementation)

1. A logged-in founder sees the `★ FOUNDER` badge next to their name in any crew chat message they author.
2. A logged-in founder sees a "You are a Founding Crew member · Price-locked at £179/yr for life" block at the top of `/account`.
3. `https://tripcrew.app/founders` renders publicly with the list of all stamped founders, reverse-chronologically, including a `X of 500 seats remain` line and a CTA to `/apply?intent=founding`.
4. The Stripe webhook, on a `customer.subscription.created` event for the Founding price ID, stamps both `profiles.founding_crew_at` and `profiles.pricing_grandfathered_at` in a single update.
5. `pnpm build` passes. `pnpm test` passes. `tsx --test src/lib/stripe/__tests__/webhook.foundingPriceLock.test.ts` passes.
