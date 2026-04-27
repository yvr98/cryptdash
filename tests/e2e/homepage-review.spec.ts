import { expect, test } from "@playwright/test";

import {
  ambiguousSearchResults,
  emptySearchResults,
  unresolvedContractSearchQuery,
  validSearchResults,
} from "../fixtures/search";

const HOMEPAGE_URL = "http://127.0.0.1:3000/";

test.describe("Homepage Task 6 Review", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOMEPAGE_URL, { waitUntil: "networkidle" });
  });

  test("hero still renders the search-first homepage", async ({ page }) => {
    await expect(page).toHaveURL(HOMEPAGE_URL);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Research a token.");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Find where it's trading.");
    await expect(page.locator("#hero-search")).toBeVisible();
    await expect(page.locator("#hero-search")).toHaveAttribute(
      "placeholder",
      "Search by name, symbol, or contract..."
    );
    await expect(page.getByRole("link", { name: "Try ETH" })).toHaveAttribute(
      "href",
      "/token/ethereum"
    );
    await expect(page.getByText("Proof-of-concept token research demo")).toBeVisible();
    await expect(page.getByText("Best demo path")).toBeVisible();
    await expect(page.getByText("Current demo coverage")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open history demo" })).toHaveAttribute(
      "href",
      "/pool/base/0x6c561b446416e1a00e8e93e221854d6ea4171372?coinId=ethereum"
    );
    await expect(page.getByText(/Search any token, see real liquidity and volume data across/i)).toBeVisible();
    await expect(page.getByText("Ethereum")).toBeVisible();
    await expect(page.getByText("Base")).toBeVisible();
    await expect(page.getByText("Arbitrum")).toBeVisible();
    await expect(page.getByText("Polygon")).toBeVisible();
    await expect(page.getByText("BNB Chain")).toBeVisible();
  });

  test("ambiguous symbol search shows selectable results without auto-routing", async ({ page }) => {
    await page.route("**/api/search?q=eth", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ambiguousSearchResults),
      });
    });

    await expect(page.getByRole("button", { name: "Search" })).toBeEnabled();
    await page.locator("#hero-search").fill("eth");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page).toHaveURL(HOMEPAGE_URL);
    await expect(page.getByText('2 results for "eth"')).toBeVisible();
    await expect(page.getByText("Select the exact token to view its detail page.")).toBeVisible();
    const resultsList = page.getByRole("list", { name: "Search results" });
    await expect(resultsList).toBeVisible();
    await expect(resultsList.getByRole("link")).toHaveCount(2);
    await expect(resultsList.locator("li").first()).toContainText("Ethereum");
    await expect(resultsList.locator("li").first()).toContainText("Supported");
    await expect(resultsList.locator("li").nth(1)).toContainText("ETH系");
    await expect(resultsList.locator("li").nth(1)).toContainText("Limited");
  });

  test("nonsense query shows a clear empty state", async ({ page }) => {
    await page.route("**/api/search?q=totallymadeuptoken", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(emptySearchResults),
      });
    });

    await expect(page.getByRole("button", { name: "Search" })).toBeEnabled();
    await page.locator("#hero-search").fill("totallymadeuptoken");
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page).toHaveURL(HOMEPAGE_URL);
    await expect(page.getByText('No results for "totallymadeuptoken"')).toBeVisible();
    await expect(page.getByText("No tokens matched. Try a different name or symbol.")).toBeVisible();
    await expect(page.getByRole("list", { name: "Search results" })).toHaveCount(0);
  });

  test("contract-like input stays honest when no exact canonical match is returned", async ({ page }) => {
    await page.route(`**/api/search?q=${unresolvedContractSearchQuery}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(validSearchResults),
      });
    });

    await expect(page.getByRole("button", { name: "Search" })).toBeEnabled();
    await page.locator("#hero-search").fill(unresolvedContractSearchQuery);
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page).toHaveURL(HOMEPAGE_URL);
    await expect(page.getByText(`No results for "${unresolvedContractSearchQuery}"`)).toBeVisible();
    await expect(page.getByText("No matching token found for this contract address.")).toBeVisible();
    await expect(page.getByRole("list", { name: "Search results" })).toHaveCount(0);
  });

  test("clicking Try ETH still navigates to the canonical route", async ({ page }) => {
    await page.getByRole("link", { name: "Try ETH" }).click();

    await page.waitForURL("**/token/ethereum", { timeout: 5000 });

    await expect(page).toHaveURL(/\/token\/ethereum$/);
  });

  test("homepage interaction stays free of console and page errors", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(`Page error: ${error.message}`);
    });

    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !message.text().includes("_next/webpack-hmr") &&
        !message.text().includes("WebSocket connection")
      ) {
        errors.push(`Console error: ${message.text()}`);
      }
    });

    await page.reload({ waitUntil: "networkidle" });

    expect(errors).toHaveLength(0);
  });
});
