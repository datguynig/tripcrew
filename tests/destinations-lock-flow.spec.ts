import { test, expect } from "@playwright/test";
import {
  getTripIdBySlug,
  readTripAiState,
  seedAiDraft,
} from "./helpers/db";

/**
 * Exercises the admin-gated lock/unlock flow end-to-end:
 *   1. Create a fresh trip (signed-in user becomes admin)
 *   2. Propose a candidate
 *   3. Lock the destination → undo toast appears → navigate to Overview
 *   4. Back to Destinations → click Unlock → Dialog opens with correct copy
 *   5. Cancel → Dialog closes, still locked
 *   6. Unlock → trip back to planning
 *
 * Avoids the AI draft path because it calls a real external provider
 * (Gemini + Google Places) and racks up cost per run. The
 * "Reset drafts" branch below seeds a fake AI draft via the service
 * role so we can exercise the destructive unlock without spending
 * money on Gemini + Places.
 */

async function createTripAndProposeCandidate(
  page: import("@playwright/test").Page,
  tripName: string,
  candidate: string,
) {
  await page.goto("/trips/new");
  await page.getByPlaceholder(/what are you calling it/i).fill(tripName);
  await page.getByRole("button", { name: /create trip/i }).click();
  await page.waitForURL(/\/trips\/[^/]+\/destinations/);

  await page.getByPlaceholder(/propose a destination/i).fill(candidate);
  // Wait for debounce, then dismiss any Mapbox dropdown so Enter
  // doesn't pick a suggestion when we click Propose.
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: /propose destination|propose pinned/i })
    .click();
  await expect(page.getByText(candidate).first()).toBeVisible();
}

test.describe("destination lock / unlock admin flow", () => {
  test("lock fires undo toast and navigates to Overview", async ({ page }) => {
    await createTripAndProposeCandidate(
      page,
      `Lock Test ${Date.now()}`,
      "Lisbon",
    );

    await page.getByRole("button", { name: /^lock destination$/i }).click();

    // Toast appears before the navigation unwinds.
    await expect(page.getByText(/destination locked\./i)).toBeVisible({
      timeout: 5_000,
    });
    await expect(
      page.getByRole("button", { name: /^undo$/i }),
    ).toBeVisible();

    // Client navigates to Overview once the transition completes.
    await page.waitForURL(/\/trips\/[^/]+$/, { timeout: 5_000 });
    await expect(
      page.getByRole("heading", { name: /the brief/i }),
    ).toBeVisible();
    // Hero meta shows the locked status chip.
    await expect(page.getByText(/locked/i).first()).toBeVisible();
  });

  test("unlock dialog shows correct actions for an undrafted trip", async ({
    page,
  }) => {
    await createTripAndProposeCandidate(
      page,
      `Unlock Dialog Test ${Date.now()}`,
      "Porto",
    );

    await page.getByRole("button", { name: /^lock destination$/i }).click();
    await page.waitForURL(/\/trips\/[^/]+$/, { timeout: 5_000 });

    // Go back to Destinations where the Unlock button lives.
    await page.getByRole("link", { name: /destinations/i }).first().click();
    await page.waitForURL(/\/destinations$/);

    await page.getByRole("button", { name: /^unlock$/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/unlock this destination/i),
    ).toBeVisible();

    // No "Keep drafts" button for an undrafted trip.
    await expect(
      dialog.getByRole("button", { name: /keep drafts/i }),
    ).toHaveCount(0);

    // Cancel closes without unlocking.
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByText(/^Decision made$/i).first(),
    ).toBeVisible();

    // Re-open and confirm unlock.
    await page.getByRole("button", { name: /^unlock$/i }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^unlock$/i })
      .click();

    // Back to planning — the Lock Destination button returns.
    await expect(
      page.getByRole("button", { name: /^lock destination$/i }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("undo toast action reverses the lock", async ({ page }) => {
    await createTripAndProposeCandidate(
      page,
      `Undo Lock Test ${Date.now()}`,
      "Madrid",
    );

    await page.getByRole("button", { name: /^lock destination$/i }).click();

    // Undo action visible in the toast.
    await expect(
      page.getByRole("button", { name: /^undo$/i }),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: /^undo$/i }).click();

    // The undo handler navigates the user to /destinations once the
    // server re-opens the trip. Wait for that URL, then verify the
    // Lock Destination button is back (trip is in planning state).
    await page.waitForURL(/\/destinations$/, { timeout: 10_000 });
    await expect(
      page.getByRole("button", { name: /^lock destination$/i }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("reset drafts wipes AI-drafted hero + meta + rows", async ({ page }) => {
    await createTripAndProposeCandidate(
      page,
      `Reset Drafts Test ${Date.now()}`,
      "Barcelona",
    );

    // Lock via UI so the trip reaches status='locked' with the real
    // winner title + revalidation. Wait on the Overview-only hero
    // heading rather than waitForURL — the dev server can be slow
    // enough that the URL race trips up the regex matcher.
    await page.getByRole("button", { name: /^lock destination$/i }).click();
    await expect(
      page.getByRole("heading", { name: /the brief/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Pull the slug out of the URL so we can seed + verify via
    // service-role Supabase client.
    const url = page.url();
    const slug = url.match(/\/trips\/([^/?#]+)/)?.[1];
    expect(slug, "slug parsed from URL").toBeTruthy();
    const tripId = await getTripIdBySlug(slug!);

    // Pretend the AI draft ran: stamp hero + meta + ai_drafted_at +
    // one ai_drafted activity + one ai_drafted booking.
    await seedAiDraft(tripId);

    // Baseline: confirm the fixture landed.
    const before = await readTripAiState(tripId);
    expect(before.trip?.ai_drafted_at, "ai_drafted_at set").not.toBeNull();
    expect(before.trip?.hero_title).toBe("Fixture hero title.");
    expect(before.aiActivityCount).toBeGreaterThanOrEqual(1);
    expect(before.aiBookingCount).toBeGreaterThanOrEqual(1);

    // Re-fetch the destinations page — server render picks up the
    // freshly seeded ai_drafted_at so the Dialog renders the
    // AI-aware copy + Keep/Reset buttons.
    await page.goto(`/trips/${slug}/destinations`);
    await page.getByRole("button", { name: /^unlock$/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/drafted by ai/i),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /^keep drafts$/i }),
    ).toBeVisible();

    await dialog.getByRole("button", { name: /^reset drafts$/i }).click();

    // Back to planning — the Lock Destination button returns.
    await expect(
      page.getByRole("button", { name: /^lock destination$/i }),
    ).toBeVisible({ timeout: 5_000 });

    // DB side: the destructive unlock should have cleared the hero,
    // wiped spec_grid + schedule from meta, and deleted the
    // ai_drafted activity + booking rows.
    const after = await readTripAiState(tripId);
    expect(after.trip?.status).toBe("planning");
    expect(after.trip?.ai_drafted_at).toBeNull();
    expect(after.trip?.hero_title).toBeNull();
    expect(after.trip?.hero_subtitle).toBeNull();
    const meta = (after.trip?.meta ?? {}) as Record<string, unknown>;
    expect(meta.spec_grid, "spec_grid cleared").toBeUndefined();
    expect(meta.schedule, "schedule cleared").toBeUndefined();
    expect(after.aiActivityCount).toBe(0);
    expect(after.aiBookingCount).toBe(0);
  });
});
