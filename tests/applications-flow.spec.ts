import { test, expect } from "@playwright/test";

test.describe("application flow", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("visitor submits an application and lands on confirmation", async ({
    page,
  }) => {
    const email = `e2e-${crypto.randomUUID().slice(0, 8)}@test.local`;
    await page.goto(`/apply?email=${encodeURIComponent(email)}`);
    await expect(
      page.getByRole("heading", { name: "One last thing." }),
    ).toBeVisible();

    await page.getByRole("button", { name: "2-3" }).click();
    await page.getByRole("button", { name: "The one who organises it" }).click();
    await page.getByRole("button", { name: "Dates never align" }).click();
    await page
      .getByRole("button", { name: "Treat it like monopoly money" })
      .click();

    await page.getByRole("button", { name: /Submit application/i }).click();

    await expect(page).toHaveURL(/\/apply\/confirmation\?p=dates/);
    await expect(
      page.getByRole("heading", { name: "You said dates never align." }),
    ).toBeVisible();
  });
});
