import { test as setup, expect } from "@playwright/test";
import path from "node:path";

const STORAGE_STATE = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.local. Run `pnpm tsx scripts/setup-test-user.ts` first.",
    );
  }

  await page.goto("/sign-in");
  await page.getByPlaceholder("you@domain.com").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), {
    timeout: 10_000,
  });
  await expect(page.locator("body")).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
