import { test, expect, type Route } from "@playwright/test";

/**
 * Verifies the CandidatesEditor auto-append + no-snap-close-reopen
 * behavior on the /trips/new form. The test mocks Mapbox's
 * search-box endpoints via page.route so it can run deterministically
 * without network or the real Mapbox API.
 *
 * Regression this covers:
 *   Picking a Mapbox suggestion used to snap the dropdown closed then
 *   re-open with the same results (the autocomplete effect re-fired
 *   against the just-set value). The fix lives in
 *   DestinationSearch.tsx via justPickedRef.
 */

const MAPBOX_PREFIX = "https://api.mapbox.com/search/searchbox/v1";

function mockSuggest(route: Route) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      suggestions: [
        {
          mapbox_id: "dXJuOm1ieHBsYzpMaXNib24",
          name: "Lisbon",
          place_formatted: "Lisbon, Lisbon, Portugal",
          feature_type: "place",
        },
        {
          mapbox_id: "dXJuOm1ieHBsYzpMaXNib24yCg",
          name: "Lisburn",
          place_formatted: "Lisburn, Northern Ireland, United Kingdom",
          feature_type: "place",
        },
      ],
    }),
  });
}

function mockRetrieve(route: Route) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      features: [
        {
          properties: {
            mapbox_id: "dXJuOm1ieHBsYzpMaXNib24",
            name: "Lisbon",
            place_formatted: "Lisbon, Lisbon, Portugal",
            context: { country: { name: "Portugal" } },
            coordinates: { longitude: -9.1427, latitude: 38.7223 },
          },
        },
      ],
    }),
  });
}

test.describe("candidates editor", () => {
  test("auto-appends a new row and focuses it after Mapbox pick", async ({
    page,
  }) => {
    await page.route(`${MAPBOX_PREFIX}/suggest**`, mockSuggest);
    await page.route(`${MAPBOX_PREFIX}/retrieve/**`, mockRetrieve);

    await page.goto("/trips/new");

    // The CandidatesEditor's first row is a DestinationSearch with
    // placeholder "e.g. Lisbon". All DestinationSearch inputs share
    // aria-label "Destination" — target the first one explicitly.
    const firstInput = page.getByPlaceholder("e.g. Lisbon");
    await firstInput.fill("Lis");

    // Suggestion listbox opens with our mocked results.
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible({ timeout: 5_000 });
    await expect(listbox.getByText("Lisbon")).toBeVisible();

    // Pick the first suggestion. Click the option text to avoid
    // matching the input's own "Lisbon" later.
    await listbox.getByRole("option").first().click();

    // Listbox collapses.
    await expect(listbox).not.toBeVisible();

    // First row now holds the pinned value + "pinned" coord ticker.
    await expect(firstInput).toHaveValue("Lisbon");
    await expect(page.getByText(/^pinned$/i)).toBeVisible();

    // A second row appears (placeholder "Add another…") and should
    // have keyboard focus so the user can keep listing.
    const secondInput = page.getByPlaceholder("Add another…");
    await expect(secondInput).toBeVisible();
    await expect(secondInput).toBeFocused();

    // No listbox is visible anywhere on the page — specifically
    // guards the snap-close-reopen regression.
    await expect(page.getByRole("listbox")).toHaveCount(0);

    // Hidden candidates input should now JSON-encode the picked row.
    const serialized = await page
      .locator('input[name="candidates"]')
      .inputValue();
    const parsed = JSON.parse(serialized) as Array<{
      title: string;
      mapboxId: string | null;
      longitude: number | null;
      latitude: number | null;
    }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("Lisbon");
    expect(parsed[0].longitude).toBeCloseTo(-9.1427, 3);
    expect(parsed[0].latitude).toBeCloseTo(38.7223, 3);
  });

  test("dropdown does not re-open after a pick when value is unchanged", async ({
    page,
  }) => {
    await page.route(`${MAPBOX_PREFIX}/suggest**`, mockSuggest);
    await page.route(`${MAPBOX_PREFIX}/retrieve/**`, mockRetrieve);

    await page.goto("/trips/new");
    const firstInput = page.getByPlaceholder("e.g. Lisbon");
    await firstInput.fill("Lis");

    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    await listbox.getByRole("option").first().click();
    await expect(listbox).not.toBeVisible();

    // Re-focus the first row. The autocomplete effect should NOT
    // refire for the same "Lisbon" value — justPickedRef suppresses
    // it. A listbox briefly reappearing is the exact regression.
    await firstInput.focus();
    // Wait past the 180ms debounce + a healthy margin.
    await page.waitForTimeout(500);
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });
});
