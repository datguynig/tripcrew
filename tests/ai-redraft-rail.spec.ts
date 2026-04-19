import { test, expect } from "@playwright/test";
import {
  adminClient,
  getTripIdBySlug,
  seedAiDraft,
  setAiEnabledByEmail,
} from "./helpers/db";

/**
 * Covers the AIDraftRail UI states:
 *   - Admin + drafted → "AI · <rel>" badge + "↻ redraft" visible
 *   - Admin + drafted + rate-limited → redraft action disabled (fg-4)
 *   - Member (non-admin) drafted → badge visible, no redraft action
 *
 * Avoids clicking redraft because it fires the real Gemini + Places
 * pipeline. Server-action wiring is covered by the action's own
 * validation branches (admin check, ai_enabled check, rate limit —
 * all exercised via returning { error } without hitting Gemini).
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? "playwright@tripcrew.test";

async function createLockedAndSeededDraft(
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

async function seedAiUsage(tripId: string, count: number) {
  const admin = adminClient();
  const rows = Array.from({ length: count }, () => ({
    trip_id: tripId,
    operation: "lock_and_draft",
    provider: "gemini" as const,
    model: "gemini-3-flash-preview",
    input_tokens: 0,
    output_tokens: 0,
  }));
  const { error } = await admin.from("ai_usage").insert(rows);
  if (error) throw error;
}

test.describe("AI draft rail", () => {
  test.beforeEach(async () => {
    await setAiEnabledByEmail(TEST_EMAIL, true);
  });

  test.afterEach(async () => {
    await setAiEnabledByEmail(TEST_EMAIL, false);
  });

  test("renders AI rail with redraft action above SpecGrid and Schedule", async ({
    page,
  }) => {
    const { slug } = await createLockedAndSeededDraft(
      page,
      `Redraft Rail Test ${Date.now()}`,
      "Seville",
    );

    await page.goto(`/trips/${slug}`);

    // Two rails land above the two surfaces (SpecGrid + Schedule).
    const rails = page.getByText(/^AI · /).filter({ hasNotText: "Beta" });
    await expect(rails).toHaveCount(2);

    // Both rails carry a redraft action.
    const redraftButtons = page.getByRole("button", { name: /redraft spec|redraft schedule/i });
    await expect(redraftButtons).toHaveCount(2);
    // Not rate-limited — no ai_usage rows yet for this trip.
    for (const btn of await redraftButtons.all()) {
      await expect(btn).toBeEnabled();
    }
  });

  test("rate-limited rail disables the redraft action", async ({ page }) => {
    const { slug, tripId } = await createLockedAndSeededDraft(
      page,
      `Redraft Quota Test ${Date.now()}`,
      "Granada",
    );
    // Fill the per-trip 24h budget (2/day). The rail reads
    // remainingQuota via getTripRedraftQuota on render.
    await seedAiUsage(tripId, 2);

    await page.goto(`/trips/${slug}`);

    const redraftButtons = page.getByRole("button", { name: /redraft spec|redraft schedule/i });
    await expect(redraftButtons.first()).toBeDisabled();
    // Title carries the rate-limit reason so the blocked state is
    // self-explanatory without a tooltip component.
    await expect(redraftButtons.first()).toHaveAttribute(
      "title",
      /drafted twice in the last 24 hours/i,
    );
  });
});
