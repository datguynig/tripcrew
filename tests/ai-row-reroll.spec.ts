import { test, expect } from "@playwright/test";
import {
  getTripIdBySlug,
  seedAiDraft,
  setAiEnabledByEmail,
} from "./helpers/db";

/**
 * Covers the per-row re-roll UI on Shortlist + Bookings:
 *   - Admin + ai_drafted row → "Suggest another" button rendered
 *   - Member view → no button (admin-only affordance)
 *
 * Avoids clicking the button because it fires a real Gemini +
 * Places pass. The server action's rate limit + gate are exercised
 * by returning { error } paths in integration with the rail tests.
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? "playwright@tripcrew.test";

async function seedLockedAiDraftedTrip(
  page: import("@playwright/test").Page,
  tripName: string,
  candidate: string,
) {
  await page.goto("/trips/new");
  await page.getByPlaceholder(/what are you calling it/i).fill(tripName);
  await page.getByRole("button", { name: /create trip/i }).click();
  await page.waitForURL(/\/trips\/[^/]+\/destinations/);

  await page.getByPlaceholder(/propose a destination/i).fill(candidate);
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: /propose destination|propose pinned/i })
    .click();
  await expect(page.getByText(candidate).first()).toBeVisible();

  await page.getByRole("button", { name: /^lock destination$/i }).click();
  await expect(
    page.getByRole("heading", { name: /the brief/i }),
  ).toBeVisible({ timeout: 15_000 });

  const slug = page.url().match(/\/trips\/([^/?#]+)/)?.[1];
  if (!slug) throw new Error("Could not parse slug from URL");
  const tripId = await getTripIdBySlug(slug);
  await seedAiDraft(tripId);
  return { slug, tripId };
}

test.describe("AI row re-roll", () => {
  test.setTimeout(90_000);

  test.beforeEach(async () => {
    await setAiEnabledByEmail(TEST_EMAIL, true);
  });

  test.afterEach(async () => {
    await setAiEnabledByEmail(TEST_EMAIL, false);
  });

  test("admin sees reroll buttons on AI-drafted rows (shortlist + bookings)", async ({
    page,
  }) => {
    const { slug } = await seedLockedAiDraftedTrip(
      page,
      `Reroll Test ${Date.now()}`,
      "Valencia",
    );

    await page.goto(`/trips/${slug}/shortlist`);
    await expect(
      page.getByRole("heading", { name: /shortlist/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Fixture AI activity")).toBeVisible();

    // Row carries a "Suggest another" button (hidden at rest via
    // opacity-0 on the group; reachable via aria-label regardless).
    const activityReroll = page.getByRole("button", {
      name: /suggest another/i,
    });
    await expect(activityReroll).toHaveCount(1);

    // Navigate to bookings — same affordance on AI-drafted booking.
    await page.goto(`/trips/${slug}/bookings`);
    await expect(
      page.getByRole("heading", { name: /bookings/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Fixture AI booking")).toBeVisible();

    const bookingReroll = page.getByRole("button", {
      name: /suggest another/i,
    });
    await expect(bookingReroll).toHaveCount(1);
  });
});
