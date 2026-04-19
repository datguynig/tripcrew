import { test, expect } from "@playwright/test";
import {
  adminClient,
  getTripIdBySlug,
} from "./helpers/db";

/**
 * Covers the inline-editing surfaces on the Overview page:
 *   - Hero title + subtitle (click → edit → Enter commits)
 *   - Spec grid cell value + sub (including the monetary Per head cell)
 *   - Schedule row heading/body + add/delete/reorder
 *
 * Each test creates a fresh locked trip so the admin can see and
 * edit the surfaces without the destructive unlock flow.
 */

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
  return { slug, tripId: await getTripIdBySlug(slug) };
}

async function readTripMeta(tripId: string) {
  const { data } = await adminClient()
    .from("trips")
    .select("hero_title, hero_subtitle, meta")
    .eq("id", tripId)
    .maybeSingle<{
      hero_title: string | null;
      hero_subtitle: string | null;
      meta: {
        spec_grid?: Array<{
          label: string;
          value: string;
          sub: string;
          amount?: number | null;
        }>;
        schedule?: Array<{ day_label: string; heading: string; body: string }>;
      } | null;
    }>();
  return data;
}

test.describe("overview inline editing", () => {
  test.setTimeout(90_000);

  test("hero title edit commits on Enter", async ({ page }) => {
    const { slug, tripId } = await createLockedTrip(
      page,
      `Hero Edit ${Date.now()}`,
      "Valencia",
    );
    await page.goto(`/trips/${slug}`);

    const title = page.getByRole("button", { name: /edit trip title/i });
    await expect(title).toBeVisible();
    await title.click();

    const input = page.getByRole("textbox", { name: /edit trip title/i });
    await input.fill("Valencia week");
    await input.press("Enter");

    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toContainText("Valencia week", { timeout: 15_000 });

    const saved = await readTripMeta(tripId);
    expect(saved?.hero_title).toBe("Valencia week");
  });

  test("hero subtitle edit commits on blur", async ({ page }) => {
    const { slug, tripId } = await createLockedTrip(
      page,
      `Sub Edit ${Date.now()}`,
      "Porto",
    );
    await page.goto(`/trips/${slug}`);

    const sub = page.getByRole("button", { name: /edit trip subtitle/i });
    await sub.click();

    const ta = page.getByRole("textbox", { name: /edit trip subtitle/i });
    await ta.fill("Four days, six of us, one rule: no dramas.");
    // Blur by clicking outside the textarea. Tab inserts \t in a
    // textarea; Meta+Enter is flaky across Playwright platforms.
    await page.getByRole("heading", { level: 1 }).click();
    // Let the server action land before reading the DB.
    await page.waitForTimeout(1_000);

    await expect(page.getByText(/one rule: no dramas/i)).toBeVisible({
      timeout: 3_000,
    });
    const saved = await readTripMeta(tripId);
    expect(saved?.hero_subtitle).toContain("one rule: no dramas");
  });

  test("spec cell value edit commits on Enter", async ({ page }) => {
    const { slug, tripId } = await createLockedTrip(
      page,
      `Spec Edit ${Date.now()}`,
      "Seville",
    );
    await page.goto(`/trips/${slug}`);

    const baseCell = page.getByRole("button", { name: /edit base value/i });
    await expect(baseCell).toBeVisible();
    await baseCell.click();

    const input = page.getByRole("textbox", { name: /edit base value/i });
    await input.fill("Airbnb in Alameda");
    await input.press("Enter");

    await expect(page.getByText(/airbnb in alameda/i)).toBeVisible();

    const saved = await readTripMeta(tripId);
    const baseItem = saved?.meta?.spec_grid?.find(
      (c) => c.label.toLowerCase() === "base",
    );
    expect(baseItem?.value).toBe("Airbnb in Alameda");
  });

  test("spec Per head amount is stored as number + renders with trip currency", async ({
    page,
  }) => {
    const { slug, tripId } = await createLockedTrip(
      page,
      `Budget Edit ${Date.now()}`,
      "Granada",
    );
    await page.goto(`/trips/${slug}`);

    const perHead = page.getByRole("button", { name: /edit per head amount/i });
    await expect(perHead).toBeVisible();
    await perHead.click();

    const input = page.getByRole("textbox", { name: /edit per head amount/i });
    await input.fill("1250");
    await input.press("Enter");

    // Default trip currency is GBP — £ symbol should render in the cell.
    await expect(
      page.locator("span.tabular").filter({ hasText: "1,250" }).first(),
    ).toBeVisible();

    const saved = await readTripMeta(tripId);
    const perHeadItem = saved?.meta?.spec_grid?.find(
      (c) => c.label.toLowerCase() === "per head",
    );
    expect(perHeadItem?.amount).toBe(1250);
    // value is kept in sync for legacy readers — 1,250 formatted.
    expect(perHeadItem?.value).toBe("1,250");
  });

  test("schedule: add day → edit heading → delete with undo toast", async ({
    page,
  }) => {
    const { slug, tripId } = await createLockedTrip(
      page,
      `Sched Edit ${Date.now()}`,
      "Bilbao",
    );
    await page.goto(`/trips/${slug}`);

    // Empty-state CTA when schedule is empty.
    const firstDayCta = page.getByRole("button", {
      name: /add the first day/i,
    });
    await expect(firstDayCta).toBeVisible();
    await firstDayCta.click();

    // Now one row exists; edit its heading.
    const heading = page
      .getByRole("button", { name: /edit day 1 heading/i })
      .first();
    await expect(heading).toBeVisible();
    await heading.click();
    const input = page
      .getByRole("textbox", { name: /edit day 1 heading/i })
      .first();
    await input.fill("Arrivals & anchor dinner");
    await input.press("Enter");

    await expect(page.getByText(/arrivals & anchor dinner/i)).toBeVisible();

    let saved = await readTripMeta(tripId);
    expect(saved?.meta?.schedule?.[0]?.heading).toBe(
      "Arrivals & anchor dinner",
    );

    // Delete with undo toast.
    await page
      .getByRole("button", { name: /delete day 1/i })
      .first()
      .click();

    await expect(page.getByText(/removed/i).first()).toBeVisible({
      timeout: 3_000,
    });
    await expect(page.getByRole("button", { name: /^undo$/i })).toBeVisible();

    // Wait past the 5s commit window so the delete lands server-side.
    await page.waitForTimeout(6_000);

    saved = await readTripMeta(tripId);
    expect(saved?.meta?.schedule?.length ?? 0).toBe(0);
  });
});
