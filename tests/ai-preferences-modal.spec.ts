import { test, expect } from "@playwright/test";
import { getTripIdBySlug, setAiEnabledByEmail } from "./helpers/db";

/**
 * Covers the AI draft preferences modal — the gate between clicking
 * "Draft with AI" on a locked trip and the server action firing.
 *
 * Avoids submitting the modal because that kicks off a real Gemini +
 * Places pass. Instead: open the modal, interact with every field,
 * verify active states, and close via Cancel. A full end-to-end
 * submit test would need a test-mode env that swaps the AI provider
 * for a stub — documented as a gap, not cheated around.
 */

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? "playwright@tripcrew.test";

async function createLockedTrip(
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
  return slug;
}

test.describe("AI draft preferences modal", () => {
  test.beforeEach(async () => {
    await setAiEnabledByEmail(TEST_EMAIL, true);
  });

  test.afterEach(async () => {
    // Don't leak beta access between test runs. Flipping this back to
    // false is safe because the test account's state is managed by
    // scripts/setup-test-user.ts anyway.
    await setAiEnabledByEmail(TEST_EMAIL, false);
  });

  test("CTA → modal → fields update → cancel closes without firing", async ({
    page,
  }) => {
    const slug = await createLockedTrip(
      page,
      `AI Prefs Test ${Date.now()}`,
      "Valencia",
    );
    // Sanity: trip exists, server-side AI config should light up the
    // CTA because GEMINI_API_KEY + GOOGLE_PLACES_API_KEY + ai_enabled
    // are all set for this run.
    await getTripIdBySlug(slug);

    // The CTA headline spans the destination inline — match on the
    // accent-mono "AI · Beta" pill instead for stability.
    await expect(page.getByText(/AI · Beta/i)).toBeVisible({
      timeout: 5_000,
    });
    const cta = page.getByRole("button", { name: /draft with ai/i });
    await expect(cta).toBeVisible();
    await cta.click();

    const modal = page.getByRole("dialog", { name: /tell us about the trip/i });
    await expect(modal).toBeVisible();

    // Airport input: type 1 char — below the 2-char typeahead
    // threshold, so no Places server action fires. Good enough to
    // prove the field is alive + satisfies the canSubmit check.
    const airportInput = modal.getByPlaceholder(/search airport/i);
    await expect(airportInput).toBeFocused();
    await airportInput.fill("H");
    await expect(airportInput).toHaveValue("H");

    // Crew size buttons — pick 4, confirm active state via the
    // accent background (the button becomes bg-accent text-bg).
    const crew4 = modal.getByRole("button", { name: /^4$/ });
    await crew4.click();
    // The button itself doesn't expose aria-pressed, but the active
    // variant flips bg-accent — check the class or re-click to test
    // idempotency. Easier: click a different size and confirm the
    // one we set is no longer the only "active" candidate. We use
    // class contains to keep this tolerant to refactors.
    await expect(crew4).toHaveClass(/bg-accent/);

    const crew6 = modal.getByRole("button", { name: /^6$/ });
    await crew6.click();
    await expect(crew6).toHaveClass(/bg-accent/);
    await expect(crew4).not.toHaveClass(/bg-accent/);

    // Budget tier buttons — pick Tight, confirm active.
    const tight = modal.getByRole("button", { name: /tight/i });
    await tight.click();
    await expect(tight).toHaveClass(/border-accent/);

    // Custom tier reveals the custom amount input.
    await modal.getByRole("button", { name: /custom/i }).click();
    const customInput = modal.getByPlaceholder(/e\.g\. 1500/);
    await expect(customInput).toBeVisible();
    await customInput.fill("1800");
    await expect(customInput).toHaveValue("1800");

    // Vibe chips toggle. "Chill" is default-on. Toggle off, then
    // toggle "Nightlife" on.
    const chill = modal.getByRole("button", { name: /^chill$/i });
    await expect(chill).toHaveAttribute("aria-pressed", "true");
    await chill.click();
    await expect(chill).toHaveAttribute("aria-pressed", "false");

    const nightlife = modal.getByRole("button", { name: /^nightlife$/i });
    await expect(nightlife).toHaveAttribute("aria-pressed", "false");
    await nightlife.click();
    await expect(nightlife).toHaveAttribute("aria-pressed", "true");

    // Cancel via the footer button closes the modal. Don't click
    // "Draft this trip →" — that fires a real Gemini call. The
    // header ✕ also has aria-label="Cancel"; scope to the footer
    // via the content-only button with visible "Cancel" text.
    await modal
      .locator("footer")
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(modal).not.toBeVisible();

    // CTA is still clickable because the draft didn't fire.
    await expect(cta).toBeVisible();
  });
});
