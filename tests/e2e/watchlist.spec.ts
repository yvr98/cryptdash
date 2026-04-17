import { expect, test } from "@playwright/test";

const STORAGE_KEY = "tokenscope_watchlist";

test.describe("Watchlist persistence", () => {
  test("adding a token to watchlist persists after page reload", async ({
    page,
  }) => {
    // Navigate to a token page
    await page.goto("http://127.0.0.1:3000/token/ethereum");

    // Wait for hydration
    const button = page.getByTestId("watchlist-button");
    await expect(button).toBeVisible({ timeout: 15000 });

    // Should start as "Add to watchlist"
    await expect(button).toContainText("Add to watchlist");

    // Click to add
    await button.click();

    // Should now show "Remove from watchlist"
    await expect(button).toContainText("Remove from watchlist");

    // Verify localStorage was written
    const stored = await page.evaluate((key) => {
      return window.localStorage.getItem(key);
    }, STORAGE_KEY);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].coinId).toBe("ethereum");

    // Reload the page
    await page.reload();

    // Wait for hydration and verify persisted state
    const buttonAfterReload = page.getByTestId("watchlist-button");
    await expect(buttonAfterReload).toBeVisible({ timeout: 15000 });
    await expect(buttonAfterReload).toContainText("Remove from watchlist");

    // Watchlist panel should show the entry
    const panel = page.getByTestId("watchlist-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Ethereum")).toBeVisible();
  });

  test("removing a token from watchlist persists after page reload", async ({
    page,
  }) => {
    // Pre-populate localStorage with an entry
    await page.goto("http://127.0.0.1:3000/token/ethereum");
    await page.waitForTimeout(1000);

    await page.evaluate((key) => {
      window.localStorage.setItem(
        key,
        JSON.stringify([
          {
            coinId: "ethereum",
            name: "Ethereum",
            symbol: "eth",
            addedAt: Date.now(),
          },
        ])
      );
    }, STORAGE_KEY);

    // Reload to pick up the pre-populated data
    await page.reload();

    const button = page.getByTestId("watchlist-button");
    await expect(button).toBeVisible({ timeout: 15000 });
    await expect(button).toContainText("Remove from watchlist");

    // Click to remove
    await button.click();
    await expect(button).toContainText("Add to watchlist");

    // Reload and verify removed state persists
    await page.reload();

    const buttonAfterReload = page.getByTestId("watchlist-button");
    await expect(buttonAfterReload).toBeVisible({ timeout: 15000 });
    await expect(buttonAfterReload).toContainText("Add to watchlist");
  });
});

test.describe("Malformed localStorage recovery", () => {
  test("page loads without crashing when localStorage contains invalid JSON", async ({
    page,
  }) => {
    // Set malformed data before navigating
    await page.goto("http://127.0.0.1:3000/token/ethereum");
    await page.waitForTimeout(1000);

    await page.evaluate((key) => {
      window.localStorage.setItem(key, "{not valid json!!!");
    }, STORAGE_KEY);

    // Reload — should not crash
    await page.reload();

    // The page should render normally
    const button = page.getByTestId("watchlist-button");
    await expect(button).toBeVisible({ timeout: 15000 });
    await expect(button).toContainText("Add to watchlist");

    // Panel should show empty state
    const panel = page.getByTestId("watchlist-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("No tokens tracked yet")).toBeVisible();
  });

  test("page loads without crashing when localStorage contains non-array JSON", async ({
    page,
  }) => {
    await page.goto("http://127.0.0.1:3000/token/ethereum");
    await page.waitForTimeout(1000);

    await page.evaluate((key) => {
      window.localStorage.setItem(key, JSON.stringify({ wrong: "shape" }));
    }, STORAGE_KEY);

    await page.reload();

    const button = page.getByTestId("watchlist-button");
    await expect(button).toBeVisible({ timeout: 15000 });
    await expect(button).toContainText("Add to watchlist");
  });

  test("adding a token after malformed state writes valid data", async ({
    page,
  }) => {
    await page.goto("http://127.0.0.1:3000/token/ethereum");
    await page.waitForTimeout(1000);

    await page.evaluate((key) => {
      window.localStorage.setItem(key, "corrupt!!!data");
    }, STORAGE_KEY);

    await page.reload();

    const button = page.getByTestId("watchlist-button");
    await expect(button).toBeVisible({ timeout: 15000 });

    // Add the token — should recover from malformed state
    await button.click();
    await expect(button).toContainText("Remove from watchlist");

    // Verify stored data is now valid
    const stored = await page.evaluate((key) => {
      return window.localStorage.getItem(key);
    }, STORAGE_KEY);
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].coinId).toBe("ethereum");
  });
});
