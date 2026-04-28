import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PUBLIC_ROUTES = [
  "/",
  `/apply?email=${encodeURIComponent("guards@test.local")}`,
  "/curated/bali",
];

const FORBIDDEN_COPY = [
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
  "£4.99",
  "4.99",
  "free trial",
  "7-day free trial",
  "7 day free trial",
  "No charge during trial",
  "Trial active",
  "Crew Plus trial",
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

    test(`${route} contains no forbidden marketing copy`, async ({ page }) => {
      await page.goto(route);
      const html = await page.content();
      for (const copy of FORBIDDEN_COPY) {
        expect(html, `${route} contains forbidden copy: ${copy}`).not.toContain(copy);
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
