import { expect, test } from "@playwright/test";

const TOKEN_PAGE_URL = "http://127.0.0.1:3000/token/ethereum";

test("token chart fallback renders without crashing the page", async ({ page }) => {
  const errors: string[] = [];

  page.on("pageerror", (error) => {
    errors.push(`Page error: ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`Console error: ${message.text()}`);
    }
  });

  await page.route("**/api/token/ethereum/ohlcv**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ candles: [] }),
    });
  });

  await page.goto(TOKEN_PAGE_URL, { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("token-ohlcv-chart")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hourly OHLCV" })).toBeVisible();
  await expect(page.getByText("Chart unavailable")).toBeVisible();
  await expect(
    page
      .getByTestId("token-ohlcv-chart")
      .getByText(
        /OHLCV data is unavailable or insufficient for this market right now|No eligible supported-chain market is available yet/i
      )
      .last()
  ).toBeVisible();

  expect(errors).toHaveLength(0);
});
