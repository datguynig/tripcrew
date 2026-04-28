import { test, expect } from "@playwright/test";

test.describe("landing motion", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("hero headline is visible quickly", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Your crew’s trip, fully planned.",
      }),
    ).toBeVisible({ timeout: 1500 });
  });

  test("reduced motion renders content and hides scroll progress", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Your crew’s trip, fully planned.",
      }),
    ).toBeVisible({ timeout: 1500 });
    await expect(page.getByTestId("scroll-progress")).toHaveCount(0);

    const faq = page.locator("#faq");
    await faq.scrollIntoViewIfNeeded();
    await faq.getByText("Why invite-only?").click();
    await expect(
      faq.getByText(/We shape the product around the first 500 crews/i),
    ).toBeVisible();
  });

  test("departure board advances without flashing empty", async ({ page }) => {
    await page.goto("/");

    const board = page.locator("#curated-trips");
    await board.scrollIntoViewIfNeeded();
    const city = board.locator("h3").first();
    const initialCity = (await city.textContent())?.trim();
    expect(initialCity).toBeTruthy();

    await board.getByRole("button", { name: "Next trip" }).click();

    await expect(city).not.toHaveText(initialCity ?? "");
    await expect(city).toBeVisible();
    await expect(board.locator("article img").first()).toBeVisible();
  });
});
