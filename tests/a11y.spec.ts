import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const TRIP_SLUG = process.env.TEST_TRIP_SLUG ?? "sweden-summer-2026-9ycp";

/**
 * WCAG 2.1 AA sweep on every significant route. Fails on any violation
 * from the default axe-core "critical/serious" categories (tagged
 * wcag2a, wcag2aa, wcag21a, wcag21aa). Colour-contrast rules are
 * skipped on dark-mode-only surfaces because axe's default thresholds
 * are tuned for light backgrounds — we enforce contrast in
 * designsystem.md §2.1 instead.
 */

async function audit(page: Page, label: string) {
  // App routes use a short entry fade. Axe samples computed colours
  // during animation, so wait until opacity has settled before checking
  // contrast.
  await page.waitForTimeout(300);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // `aria-hidden` content is not exposed to assistive tech — contrast
    // doesn't apply. Next.js dev-tools button is injected in dev only.
    .exclude('[aria-hidden="true"]')
    .exclude("nextjs-portal")
    .exclude("[data-nextjs-dev-tools-button]")
    .analyze();

  if (results.violations.length > 0) {
    console.log(`\n=== a11y violations on ${label} ===`);
    for (const v of results.violations) {
      console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
      for (const node of v.nodes.slice(0, 3)) {
        console.log(`    → ${node.target.join(" ")}`);
      }
      console.log(`    → ${v.helpUrl}`);
    }
  }

  expect(results.violations, `violations on ${label}`).toEqual([]);
}

test.describe("a11y", () => {
  test("sign-in page", async ({ page }) => {
    // Use a fresh context without storageState — this page is the
    // unauthed entry and its affordances only make sense signed out.
    await page.context().clearCookies();
    await page.goto("/sign-in");
    await audit(page, "/sign-in");
  });

  test("dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await audit(page, "/dashboard");
  });

  test("new trip form", async ({ page }) => {
    await page.goto("/trips/new");
    await audit(page, "/trips/new");
  });

  test("overview", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}`);
    await audit(page, "/trips/[slug]");
  });

  test("crew", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}/crew`);
    await audit(page, "/trips/[slug]/crew");
  });

  test("shortlist", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}/shortlist`);
    await audit(page, "/trips/[slug]/shortlist");
  });

  test("bookings", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}/bookings`);
    await audit(page, "/trips/[slug]/bookings");
  });

  test("ledger", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}/ledger`);
    await audit(page, "/trips/[slug]/ledger");
  });

  test("feed", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}/feed`);
    await audit(page, "/trips/[slug]/feed");
  });
});
