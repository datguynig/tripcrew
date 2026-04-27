import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PUBLIC_ROUTES = [
  "/",
  `/apply?email=${encodeURIComponent("guards@test.local")}`,
  "/sample-trip/lisbon",
];

const FORBIDDEN_BRANDS = [
  "Splitwise",
  "splitwise",
  "WhatsApp",
  "Whatsapp",
  "whatsapp",
  "Google Flights",
  "google flights",
  "Wanderlog",
  "TripIt",
  "SquadTrip",
  "Layla",
  "Mindtrip",
  "Roam Around",
];

const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u;

test.describe("public surfaces — content guards", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const route of PUBLIC_ROUTES) {
    test(`${route} contains no emoji`, async ({ page }) => {
      await page.goto(route);
      const html = await page.content();
      expect(EMOJI_RE.test(html)).toBe(false);
    });

    test(`${route} contains no competitor brand names`, async ({ page }) => {
      await page.goto(route);
      const html = await page.content();
      for (const brand of FORBIDDEN_BRANDS) {
        expect(html, `${route} mentions ${brand}`).not.toContain(brand);
      }
    });

    test(`${route} passes axe a11y sweep`, async ({ page }) => {
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .exclude('[aria-hidden="true"]')
        .exclude("nextjs-portal")
        .exclude("[data-nextjs-dev-tools-button]")
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
