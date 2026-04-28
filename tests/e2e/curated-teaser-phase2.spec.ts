/**
 * Phase 2 e2e for the curated trip Founding fast lane.
 *
 * PREREQ: requires both migrations applied to the test Supabase:
 *   supabase/migrations/20260430000000_draft_leads.sql
 *   supabase/migrations/20260430000100_founding_reservations.sql
 * Without the second one, /curated/[slug]/founding-checkout throws on
 * the reserve_founding_seat RPC call. Run `supabase db reset` (or apply
 * the migration manually) before running this suite locally.
 *
 * Tests that hit Gemini are skipped when GEMINI_API_KEY is not set.
 * Tests that hit Stripe are skipped when STRIPE_SECRET_KEY +
 * STRIPE_FOUNDING_PRICE_ID are not set.
 */
import { test, expect } from "@playwright/test";

const SLUG = "bali";
const ROUTE = `/curated/${SLUG}`;

test.describe("curated teaser — phase 2 founding fast lane", () => {
  // Marketing surface is unauthed; clear the storage state seeded by
  // tests/auth.setup.ts so we hit the public flow.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("claim a founding spot from the personalised view", async ({ page }) => {
    test.skip(
      !process.env.GEMINI_API_KEY,
      "Requires GEMINI_API_KEY for the personalised view to render",
    );
    test.skip(
      !process.env.STRIPE_FOUNDING_PRICE_ID,
      "Requires STRIPE_FOUNDING_PRICE_ID so the Pay button can render the live action",
    );

    await page.goto(ROUTE);

    // Origin: type "MAN" into the airport typeahead, wait for the
    // public-airports action to populate suggestions, click the first.
    const fromInput = page.getByRole("combobox", { name: /01 \/ From/i });
    await fromInput.fill("MAN");
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible({ timeout: 10_000 });
    await listbox.locator('[role="option"]').first().click();

    await page.getByRole("radio", { name: "5–6" }).click();
    await page.getByRole("radio", { name: "a week" }).click();
    await page.getByRole("radio", { name: /£1\.5k/i }).click();

    const email = `teaser-founding-${Date.now()}@example.com`;
    await page.getByLabel(/05 \/ Email/i).fill(email);
    await page.getByRole("button", { name: /See my Bali/i }).click();

    // Personalised view rendered server-side after the cookie set.
    await expect(page.getByText(/Draft preview/i)).toBeVisible({
      timeout: 30_000,
    });

    // Click the founding-spot CTA.
    await page.getByRole("link", { name: /Claim a founding spot/i }).click();
    await expect(page).toHaveURL(
      new RegExp(`/curated/${SLUG}/founding-checkout`),
    );

    // Hold page renders — eyebrow, h1, ticket stub cells, Pay button.
    await expect(
      page.getByText(/Founding spot · Held/i),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /founding spot is held for 15 minutes/i,
      }),
    ).toBeVisible();

    // Countdown should be in the 14:5x range or 15:00 — the timer ticks
    // immediately on mount, so allow either.
    await expect(
      page.locator("text=/^(14|15)$/").first(),
    ).toBeVisible();

    // Pay button is present and enabled (Stripe call not yet fired).
    const payButton = page.getByRole("button", { name: /Pay £179 \/ year/i });
    await expect(payButton).toBeVisible();
    await expect(payButton).toBeEnabled();

    // 14-day refund line.
    await expect(
      page.getByText(/Price-locked for life · 14-day refund window/i),
    ).toBeVisible();
  });

  test.fixme("sold-out state when seats exhausted", async () => {
    // Hard to drive without a fixture that pre-seeds 500 active holds
    // against the test DB. Manual repro:
    //   1. Apply the founding_reservations migration.
    //   2. Insert 500 rows: insert into founding_reservations (expires_at)
    //      select now() + interval '1 day' from generate_series(1, 500);
    //   3. Walk the form to get a draft, click the founding-spot CTA.
    //   4. Land on /founding-checkout — the page should render the
    //      "All 500 founding spots are taken." sold-out hero with the
    //      "Browse curated trips →" and "Apply to Crew Plus →" links.
  });
});
