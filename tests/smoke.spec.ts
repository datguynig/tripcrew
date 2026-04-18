import { test, expect } from "@playwright/test";

const TRIP_SLUG = process.env.TEST_TRIP_SLUG ?? "sweden-summer-2026-9ycp";

test.describe("dashboard", () => {
  test("lists the user's trips", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /your trips/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /create trip/i })).toBeVisible();
  });

  test("trip switcher opens and shows current trip", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}`);
    const trigger = page.getByRole("button", { name: /sweden|tripcrew/i }).first();
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible();
    // Close on Escape
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).not.toBeVisible();
  });
});

test.describe("trip pages", () => {
  test("overview renders hero, stats, brief", async ({ page }) => {
    await page.goto(`/trips/${TRIP_SLUG}`);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.getByText(/T-minus|target budget|bookings|kitty/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /the brief/i })).toBeVisible();
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

test.describe("date picker", () => {
  test("opens, picks a date, closes", async ({ page }) => {
    await page.goto("/trips/new");
    // Button's accessible name isn't always "Pick a date" — it inherits
    // the Field's label association. Target by aria-haspopup instead.
    const trigger = page.locator('[aria-haspopup="dialog"]').first();
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: /today/i }).click();
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
