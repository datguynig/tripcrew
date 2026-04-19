import { test, expect } from "@playwright/test";
import {
  getTripIdBySlug,
  seedAiDraft,
  setAiEnabledByEmail,
} from "./helpers/db";

/**
 * Covers the "Try again with a note" affordance on the trip overview's
 * AIFeedbackCard. When a member votes 👎 and writes at least 4 chars
 * of context, a secondary "Try again →" button surfaces — clicking it
 * fires a full redraft with the note in the Gemini prompt.
 *
 * Test verifies the button surfaces under the right conditions.
 * Doesn't click — that fires a real Gemini + Places pass.
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

test.describe("AI feedback → try again", () => {
  test.setTimeout(90_000);

  test.beforeEach(async () => {
    await setAiEnabledByEmail(TEST_EMAIL, true);
  });

  test.afterEach(async () => {
    await setAiEnabledByEmail(TEST_EMAIL, false);
  });

  test("thumbs-down + note reveals a 'Try again' button", async ({ page }) => {
    const { slug } = await seedLockedAiDraftedTrip(
      page,
      `Feedback Retry ${Date.now()}`,
      "Lisbon",
    );

    await page.goto(`/trips/${slug}`);
    await expect(
      page.getByRole("heading", { name: /the brief/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Feedback card sits below the brief. Thumbs-down first.
    const down = page.getByRole("button", { name: /poor draft/i });
    await expect(down).toBeVisible();
    await down.click();

    // Note input appears with the 👎 placeholder.
    const note = page.getByPlaceholder(/what would land better/i);
    await expect(note).toBeVisible();
    // < 4 chars — Try again should not show.
    await note.fill("ok");
    await expect(
      page.getByRole("button", { name: /try again/i }),
    ).toHaveCount(0);

    // ≥ 4 chars — Try again shows.
    await note.fill("too many bars, we don't drink");
    await expect(
      page.getByRole("button", { name: /try again/i }),
    ).toBeVisible();
  });

  test("thumbs-up does not show 'Try again'", async ({ page }) => {
    const { slug } = await seedLockedAiDraftedTrip(
      page,
      `Feedback Up ${Date.now()}`,
      "Porto",
    );

    await page.goto(`/trips/${slug}`);
    await expect(
      page.getByRole("heading", { name: /the brief/i }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /good draft/i }).click();

    const note = page.getByPlaceholder(/what landed well/i);
    await expect(note).toBeVisible();
    await note.fill("the schedule was great");

    await expect(
      page.getByRole("button", { name: /try again/i }),
    ).toHaveCount(0);
  });
});
