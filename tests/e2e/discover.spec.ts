// =============================================================================
// TokenScope — Discovery Page E2E Test
// =============================================================================
//
// Verifies the real /discover route under deterministic happy, empty, and
// degraded conditions using ?fixture= query params. The route exercises the
// full SSR pipeline: page.tsx → getDiscoveryPageData → shell rendering.
//
// The deterministic shaping logic is verified more thoroughly in:
//   - tests/data/discovery-page-data.test.ts
//   - tests/components/discovery-table.test.tsx
// =============================================================================

import { expect, test } from "@playwright/test";

const DISCOVER_BASE = "http://127.0.0.1:3000/discover";

test.describe("Discovery page — real route", () => {
  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  test("happy path shows table with chain, pair, liquidity, volume, txs, and freshness", async ({
    page,
  }) => {
    await page.goto(`${DISCOVER_BASE}?fixture=happy`, {
      waitUntil: "networkidle",
    });

    // Page header shows canonical copy
    await expect(page.getByRole('main').getByText('Discover', { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Explore trending pools across supported chains",
      })
    ).toBeVisible();
    await expect(
      page.getByText(/Discovery order is upstream-ranked/)
    ).toBeVisible();

    // Table section header
    await expect(page.getByText("Discovery snapshot")).toBeVisible();
    await expect(page.getByText("Showing 3 supported pools.")).toBeVisible();

    const table = page.getByRole("table");

    // All required column headers are visible (desktop table)
    for (const col of [
      "Pair",
      "DEX",
      "Chain",
      "Liquidity",
      "24h Vol",
      "Txs",
      "Freshness",
    ]) {
      await expect(
        table.getByRole("columnheader", { name: col })
      ).toBeVisible();
    }

    // Rows show supported chain names (scoped to desktop table)
    await expect(table.getByText("Ethereum")).toBeVisible();
    await expect(table.getByText("Base")).toBeVisible();
    await expect(table.getByText("Arbitrum")).toBeVisible();

    // Rows show pair labels
    await expect(table.getByText("WETH / USDC").first()).toBeVisible();
    await expect(table.getByText("ARB / WETH")).toBeVisible();

    // Rows show DEX names
    await expect(table.getByText("Uniswap V3")).toBeVisible();
    await expect(table.getByText("Aerodrome")).toBeVisible();
    await expect(table.getByText("Camelot")).toBeVisible();

    // Rows show formatted liquidity values
    await expect(table.getByText("$12.50M")).toBeVisible();
    await expect(table.getByText("$8.20M")).toBeVisible();

    // Rows show formatted volume values
    await expect(table.getByText("$3.40M")).toBeVisible();
    await expect(table.getByText("$2.10M")).toBeVisible();

    // Rows show transaction counts
    await expect(table.getByText("1,234")).toBeVisible();
    await expect(table.getByText("876")).toBeVisible();

    // Freshness badges are visible
    await expect(table.getByText("Established")).toBeVisible();
    await expect(table.getByText("Recent")).toBeVisible();
    await expect(table.getByText("New")).toBeVisible();

    // No upstream error banner
    await expect(
      page.getByTestId("discover-upstream-error-banner")
    ).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  test("empty state is honest when upstream has no supported-chain pools", async ({
    page,
  }) => {
    await page.goto(`${DISCOVER_BASE}?fixture=empty`, {
      waitUntil: "networkidle",
    });

    // Page header shows empty-state copy from canonical source
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "No supported-chain pools in this snapshot",
      })
    ).toBeVisible();
    await expect(
      page.getByText(/none mapped to TokenScope's supported chains/)
    ).toBeVisible();

    // No table or row data is fabricated
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("columnheader")).toHaveCount(0);

    // No upstream error banner (the data arrived, just no supported rows)
    await expect(
      page.getByTestId("discover-upstream-error-banner")
    ).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  // Degraded state
  // -------------------------------------------------------------------------

  test("degraded state shows upstream error banner alongside available rows", async ({
    page,
  }) => {
    await page.goto(`${DISCOVER_BASE}?fixture=degraded`, {
      waitUntil: "networkidle",
    });

    // Page header shows degraded copy
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Discovery data partially unavailable",
      })
    ).toBeVisible();

    // Upstream error banner is visible
    const banner = page.getByTestId("discover-upstream-error-banner");
    await expect(banner).toBeVisible();
    await expect(banner.getByText("Discovery data partially unavailable")).toBeVisible();
    await expect(banner.getByText("rate-limiting")).toBeVisible();
    await expect(
      banner.getByText("Showing available discovery rows")
    ).toBeVisible();

    // Table is still rendered with partial data
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect(page.getByText("Showing 1 supported pools.")).toBeVisible();

    // Available row data is shown (scoped to desktop table)
    await expect(table.getByText("WETH / USDC")).toBeVisible();
    await expect(table.getByText("Uniswap V3")).toBeVisible();
    await expect(table.getByText("Ethereum")).toBeVisible();

    // Column headers remain visible
    for (const col of [
      "Pair",
      "DEX",
      "Chain",
      "Liquidity",
      "24h Vol",
      "Txs",
      "Freshness",
    ]) {
      await expect(
        table.getByRole("columnheader", { name: col })
      ).toBeVisible();
    }
  });


  // -----------------------------------------------------------------------
  // Real navigation proof: homepage → navbar Discover link → /discover
  // -----------------------------------------------------------------------

  test("navigating from homepage via navbar Discover link lands on /discover with visible marker", async ({
    page,
  }) => {
    // Start on the homepage
    await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });

    // Click the shared navbar Discover link
    const discoverLink = page.getByRole("link", { name: "Discover" });
    await expect(discoverLink).toBeVisible();
    await discoverLink.click();

    // Assert navigation to /discover
    await page.waitForURL("**/discover", { timeout: 10000 });
    await expect(page).toHaveURL("http://127.0.0.1:3000/discover");

    // Assert the stable discovery page marker is visible
    // The shell always renders the "Discover" label unconditionally
    await expect(page.getByRole('main').getByText('Discover', { exact: true })).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // No unhandled errors
  // -------------------------------------------------------------------------

  test("discovery fixtures are free of unhandled page errors", async ({
    page,
  }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(`Page error: ${error.message}`);
    });

    // Run through all three fixtures to ensure none produce JS errors
    await page.goto(`${DISCOVER_BASE}?fixture=happy`, {
      waitUntil: "networkidle",
    });
    await page.goto(`${DISCOVER_BASE}?fixture=empty`, {
      waitUntil: "networkidle",
    });
    await page.goto(`${DISCOVER_BASE}?fixture=degraded`, {
      waitUntil: "networkidle",
    });

    expect(errors).toHaveLength(0);
  });
});
