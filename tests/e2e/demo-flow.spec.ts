import { expect, test } from "@playwright/test";

const DEPLOYED_ETH_URL =
  process.env.DEPLOYED_ETH_URL ?? "https://cryptdash.vercel.app/token/ethereum";

test.describe("Deployed ETH deep-link flow", () => {
  test("ETH token page loads and shows the core token research flow", async ({
    page,
  }) => {
    await page.goto(DEPLOYED_ETH_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Token identity section is visible (heading with token name)
    const tokenHeading = page.getByRole("heading", { level: 1 });
    await expect(tokenHeading).toBeVisible({ timeout: 15_000 });
    await expect(tokenHeading).toContainText("Ethereum");

    const tokenHeaderSection = page.locator("section").first();
    await expect(tokenHeaderSection.getByText("ETH", { exact: true })).toBeVisible();
    await expect(page.getByTestId("watchlist-button")).toBeVisible();

    await expect(page.getByText("Pool suggestion")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Suggested best place to trade|Close call across pools|Comparison unavailable|Insufficient data/i)).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText("Market chart")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Hourly OHLCV" })).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText("Pool comparison")).toBeVisible({ timeout: 10_000 });
  });

  test("ETH token page is free of unhandled page errors", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(`Page error: ${error.message}`);
    });

    await page.goto(DEPLOYED_ETH_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Wait for the page to settle after client-side hydration
    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2000);

    expect(errors).toHaveLength(0);
  });
});
