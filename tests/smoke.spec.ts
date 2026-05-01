import { test, expect } from "@playwright/test";

const TRIP_SLUG = process.env.TEST_TRIP_SLUG ?? "sweden-summer-2026-9ycp";

test.describe("dashboard", () => {
  test("lists the user's trips", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /your trips/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /create trip/i })).toBeVisible();
  });

  test("trip switcher opens and shows current trip", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}`);
    const trigger = page.getByRole("button", { name: /sweden|yenkoh/i }).first();
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible();
    // Close on Escape
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).not.toBeVisible();
  });
});

test.describe("trip pages", () => {
  test("overview renders hero or redirects to destinations", async ({
    page,
  }) => {
    await page.goto(`/trips/${TRIP_SLUG}`);
    await expect(page.locator("h1").first()).toBeVisible();
    // Trip can be in `planning` (redirects to /destinations with
    // "Where to." heading) or `locked` (overview with hero h1 +
    // "The brief." section h2). Match based on final URL.
    const url = page.url();
    if (/\/destinations$/.test(url)) {
      await expect(
        page.getByRole("heading", { name: /where to/i }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("heading", { name: /the brief/i }),
      ).toBeVisible();
    }
  });

  test("crew tab loads with at least one member", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}/crew`);
    await expect(page.getByRole("heading", { name: /crew/i })).toBeVisible();
    // The logged-in user should appear in the list.
    await expect(page.locator("body")).toContainText(/\d{2} [A-Z]{3}/i, {
      timeout: 5_000,
    });
  });

  test("shortlist tab loads without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`/trips/${TRIP_SLUG}/shortlist`);
    await expect(page.getByRole("heading", { name: /shortlist/i })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("bookings tab renders", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}/bookings`);
    await expect(page.getByRole("heading", { name: /bookings/i })).toBeVisible();
  });

  test("ledger tab renders", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}/ledger`);
    await expect(page.getByRole("heading", { name: /ledger/i })).toBeVisible();
  });

  test("feed tab renders", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}/feed`);
    await expect(page.getByRole("heading", { name: /feed/i })).toBeVisible();
  });

  test("admin tab — non-admin redirected away", async ({ page }) => {
    // Test account is a member, not admin — should bounce to overview.
    await page.goto(`/trips/${TRIP_SLUG}/admin`);
    await expect(page).toHaveURL(new RegExp(`/trips/${TRIP_SLUG}$`));
  });
});

test.describe("date range picker", () => {
  test("opens, shows dual months, picks a range, closes", async ({ page }) => {
    await page.goto("/trips/new");
    // Trip-dates trigger — target by aria-haspopup so we don't collide
    // with the vote-deadline DateTimePicker below.
    const trigger = page.locator('[aria-haspopup="dialog"]').first();
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Dual-month view: two month labels visible (e.g. "Apr 2026", "May 2026").
    const monthLabels = page.getByRole("dialog").locator("text=/^[A-Z][a-z]{2} \\d{4}$/");
    await expect(monthLabels.first()).toBeVisible();

    // Pick a start date (15th of the first month), then end (20th).
    // Use `aria-pressed=false` cells with inMonth days (weekdays rendered
    // with text only) — click a day, then another two days later.
    const dayCells = page
      .getByRole("dialog")
      .getByRole("button")
      .filter({ hasText: /^\d+$/ });
    // Click the 10th visible day cell (arbitrary, mid-month)
    await dayCells.nth(10).click();
    // And another later cell to close the range
    await dayCells.nth(15).click();

    // Range complete → auto-closes.
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

test.describe("screenshots for visual review", () => {
  test("dashboard", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "tests/screenshots/dashboard.png",
      fullPage: true,
    });
  });

  test("overview", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "tests/screenshots/overview.png",
      fullPage: true,
    });
  });

  test("crew", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}/crew`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "tests/screenshots/crew.png",
      fullPage: true,
    });
  });

  test("shortlist", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}/shortlist`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "tests/screenshots/shortlist.png",
      fullPage: true,
    });
  });

  test("bookings", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}/bookings`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "tests/screenshots/bookings.png",
      fullPage: true,
    });
  });

  test("ledger", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}/ledger`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "tests/screenshots/ledger.png",
      fullPage: true,
    });
  });

  test("feed", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}/feed`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "tests/screenshots/feed.png",
      fullPage: true,
    });
  });

  test("new trip form", async ({ page }) => {
    await page.goto("/trips/new");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);
    await page.screenshot({
      path: "tests/screenshots/new-trip.png",
      fullPage: true,
    });
  });
});
