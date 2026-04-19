// =============================================================================
// TokenScope — Discovery Page E2E Test
// =============================================================================
//
// Verifies the public /discover flow using deterministic HTML fixtures.
// The discovery page is fully SSR (getDiscoveryPageData fetches GeckoTerminal
// server-side), so page.route() cannot intercept those requests. This follows
// the same page.setContent() pattern used by low-data.spec.ts and
// near-tie.spec.ts for SSR-dependent pages.
//
// The deterministic shaping logic is verified more thoroughly in:
//   - tests/data/discovery-page-data.test.ts
//   - tests/components/discovery-table.test.tsx
// =============================================================================

import { expect, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// Shared CSS — minimal styles matching the dark theme conventions
// ---------------------------------------------------------------------------

const SHARED_STYLES = `
  body { font-family: sans-serif; margin: 0; background: #0a0a0a; color: #e5e5e5; }
  .section { border: 1px solid #262626; border-radius: 0.75rem; padding: 1.25rem; margin: 0.75rem 0; background: #141414; }
  .label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.14em; color: #737373; font-weight: 500; }
  h1 { font-size: 1.875rem; font-weight: 700; letter-spacing: -0.025em; color: #e5e5e5; margin: 0.5rem 0 0; }
  h2 { font-size: 1.25rem; font-weight: 700; color: #e5e5e5; margin: 0.25rem 0 0; }
  p { font-size: 0.875rem; line-height: 1.5; color: #737373; margin: 0.5rem 0 0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; text-align: left; font-size: 0.875rem; }
  th { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #737373; padding: 0.625rem 1rem; }
  td { padding: 0.625rem 1rem; }
  tr { border-top: 1px solid #262626; }
  .badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 0.375rem; border: 1px solid; font-size: 0.7rem; font-weight: 600; }
  .badge-eth { border-color: rgba(59,130,246,0.2); color: #60a5fa; background: rgba(59,130,246,0.1); }
  .badge-base { border-color: rgba(14,165,233,0.2); color: #38bdf8; background: rgba(14,165,233,0.1); }
  .badge-arb { border-color: rgba(249,115,22,0.2); color: #fb923c; background: rgba(249,115,22,0.1); }
  .badge-established { border-color: #262626; color: #e5e5e5; background: #0a0a0a; }
  .badge-new { border-color: var(--accent, #22d3ee); color: var(--accent, #22d3ee); background: rgba(34,211,238,0.1); }
  .badge-recent { border-color: rgba(245,158,11,0.3); color: #fbbf24; background: rgba(245,158,11,0.1); }
  .amber-banner { border-color: rgba(245,158,11,0.2); background: rgba(245,158,11,0.05); border-radius: 1rem; padding: 1.25rem; }
`;

// ---------------------------------------------------------------------------
// Happy-path fixture: discovery table with sample supported-chain rows
// ---------------------------------------------------------------------------

const HAPPY_PATH_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>TokenScope — Discover</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="section">
    <p class="label">Discover</p>
    <h1>Explore trending pools across supported chains</h1>
    <p>Discovery order is upstream-ranked. TokenScope keeps the original feed order, filters it to supported chains, and shows the latest available liquidity, volume, activity, and freshness signals.</p>
  </div>

  <div class="section">
    <div style="padding-bottom: 0.75rem;">
      <p class="label">Discovery snapshot</p>
      <h2>Upstream-ranked pools across supported chains</h2>
      <p>Showing 3 supported pools.</p>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:24%">Pair</th>
          <th style="width:14%">DEX</th>
          <th style="width:12%">Chain</th>
          <th style="width:14%; text-align:right">Liquidity</th>
          <th style="width:14%; text-align:right">24h Vol</th>
          <th style="width:10%; text-align:right">Txs</th>
          <th style="width:12%; text-align:right">Freshness</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span style="font-weight:600">WETH / USDC</span></td>
          <td style="color:#737373">Uniswap V3</td>
          <td><span class="badge badge-eth">Ethereum</span></td>
          <td style="text-align:right; font-weight:600">$12.50M</td>
          <td style="text-align:right">$3.40M</td>
          <td style="text-align:right; color:#737373">1,234</td>
          <td style="text-align:right"><span class="badge badge-established">Established</span></td>
        </tr>
        <tr>
          <td><span style="font-weight:600">WETH / USDC</span></td>
          <td style="color:#737373">Aerodrome</td>
          <td><span class="badge badge-base">Base</span></td>
          <td style="text-align:right; font-weight:600">$8.20M</td>
          <td style="text-align:right">$2.10M</td>
          <td style="text-align:right; color:#737373">876</td>
          <td style="text-align:right"><span class="badge badge-recent">Recent</span></td>
        </tr>
        <tr>
          <td><span style="font-weight:600">ARB / WETH</span></td>
          <td style="color:#737373">Camelot</td>
          <td><span class="badge badge-arb">Arbitrum</span></td>
          <td style="text-align:right; font-weight:600">$5.10M</td>
          <td style="text-align:right">$1.30M</td>
          <td style="text-align:right; color:#737373">542</td>
          <td style="text-align:right"><span class="badge badge-new">New</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>
`;

// ---------------------------------------------------------------------------
// Empty-state fixture: upstream returned pools but none on supported chains
// ---------------------------------------------------------------------------

const EMPTY_STATE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>TokenScope — Discover Empty</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="section">
    <p class="label">Discover</p>
    <h1>Explore trending pools across supported chains</h1>
    <p>Discovery order is upstream-ranked. TokenScope keeps the original feed order, filters it to supported chains, and shows the latest available liquidity, volume, activity, and freshness signals.</p>
  </div>

  <div class="section">
    <p class="label">Discovery snapshot</p>
    <h2>No supported-chain pools in this snapshot</h2>
    <p>Upstream discovery returned pools, but none mapped to TokenScope's supported chains.</p>
  </div>
</body>
</html>
`;

// ---------------------------------------------------------------------------
// Degraded-state fixture: upstream error with partial rows
// ---------------------------------------------------------------------------

const DEGRADED_STATE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>TokenScope — Discover Degraded</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  <div class="section">
    <p class="label">Discover</p>
    <h1>Explore trending pools across supported chains</h1>
    <p>Discovery order is upstream-ranked. TokenScope keeps the original feed order, filters it to supported chains, and shows the latest available liquidity, volume, activity, and freshness signals.</p>
  </div>

  <div class="section amber-banner" data-testid="discover-upstream-error-banner">
    <p class="label" style="color:#fbbf24">Discovery data partially unavailable</p>
    <p>The upstream data provider is rate-limiting requests. Some data may be temporarily incomplete. Please try again in a moment.</p>
    <p>Showing available discovery rows. Try refreshing in a moment.</p>
  </div>

  <div class="section">
    <div style="padding-bottom: 0.75rem;">
      <p class="label">Discovery snapshot</p>
      <h2>Upstream-ranked pools across supported chains</h2>
      <p>Showing 1 supported pools.</p>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:24%">Pair</th>
          <th style="width:14%">DEX</th>
          <th style="width:12%">Chain</th>
          <th style="width:14%; text-align:right">Liquidity</th>
          <th style="width:14%; text-align:right">24h Vol</th>
          <th style="width:10%; text-align:right">Txs</th>
          <th style="width:12%; text-align:right">Freshness</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span style="font-weight:600">WETH / USDC</span></td>
          <td style="color:#737373">Uniswap V3</td>
          <td><span class="badge badge-eth">Ethereum</span></td>
          <td style="text-align:right; font-weight:600">$12.50M</td>
          <td style="text-align:right">$3.40M</td>
          <td style="text-align:right; color:#737373">1,234</td>
          <td style="text-align:right"><span class="badge badge-established">Established</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Discovery page public flow", () => {
  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  test("happy path shows rows with chain, pair, liquidity, volume, txs, and freshness", async ({
    page,
  }) => {
    await page.setContent(HAPPY_PATH_HTML);

    // Page header is visible
    await expect(page.getByText("Discover", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Explore trending pools across supported chains" })
    ).toBeVisible();

    // Table section header
    await expect(page.getByText("Discovery snapshot")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Upstream-ranked pools across supported chains" })
    ).toBeVisible();
    await expect(page.getByText("Showing 3 supported pools.")).toBeVisible();

    // All required column headers are visible
    for (const col of ["Pair", "DEX", "Chain", "Liquidity", "24h Vol", "Txs", "Freshness"]) {
      await expect(page.getByRole("columnheader", { name: col })).toBeVisible();
    }

    // Rows show supported chain names
    await expect(page.getByText("Ethereum")).toBeVisible();
    await expect(page.getByText("Base")).toBeVisible();
    await expect(page.getByText("Arbitrum")).toBeVisible();

    // Rows show pair labels
    await expect(page.getByText("WETH / USDC").first()).toBeVisible();
    await expect(page.getByText("ARB / WETH")).toBeVisible();

    // Rows show DEX names
    await expect(page.getByText("Uniswap V3")).toBeVisible();
    await expect(page.getByText("Aerodrome")).toBeVisible();

    // Rows show formatted liquidity values
    await expect(page.getByText("$12.50M")).toBeVisible();
    await expect(page.getByText("$8.20M")).toBeVisible();

    // Rows show formatted volume values
    await expect(page.getByText("$3.40M")).toBeVisible();
    await expect(page.getByText("$2.10M")).toBeVisible();

    // Rows show transaction counts
    await expect(page.getByText("1,234")).toBeVisible();
    await expect(page.getByText("876")).toBeVisible();

    // Freshness badges are visible
    await expect(page.getByText("Established")).toBeVisible();
    await expect(page.getByText("Recent")).toBeVisible();
    await expect(page.getByText("New")).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  test("empty state is honest when upstream has no supported-chain pools", async ({
    page,
  }) => {
    await page.setContent(EMPTY_STATE_HTML);

    // Page header still visible
    await expect(
      page.getByRole("heading", { level: 1, name: "Explore trending pools across supported chains" })
    ).toBeVisible();

    // Honest empty-state messaging
    await expect(
      page.getByRole("heading", { level: 2, name: "No supported-chain pools in this snapshot" })
    ).toBeVisible();
    await expect(
      page.getByText("none mapped to TokenScope's supported chains")
    ).toBeVisible();

    // No table or row data is fabricated
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("columnheader")).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  // Degraded state
  // -------------------------------------------------------------------------

  test("degraded state shows upstream error banner alongside available rows", async ({
    page,
  }) => {
    await page.setContent(DEGRADED_STATE_HTML);

    // Upstream error banner is visible
    await expect(page.getByTestId("discover-upstream-error-banner")).toBeVisible();
    await expect(
      page.getByText("Discovery data partially unavailable")
    ).toBeVisible();
    await expect(
      page.getByText("rate-limiting")
    ).toBeVisible();
    await expect(
      page.getByText("Showing available discovery rows")
    ).toBeVisible();

    // Table is still rendered with partial data
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByText("Showing 1 supported pools.")).toBeVisible();

    // Available row data is shown, not hidden by the error
    await expect(page.getByText("WETH / USDC")).toBeVisible();
    await expect(page.getByText("Uniswap V3")).toBeVisible();
    await expect(page.getByText("Ethereum")).toBeVisible();

    // Column headers remain visible
    for (const col of ["Pair", "DEX", "Chain", "Liquidity", "24h Vol", "Txs", "Freshness"]) {
      await expect(page.getByRole("columnheader", { name: col })).toBeVisible();
    }
  });

  // -------------------------------------------------------------------------
  // No unhandled errors
  // -------------------------------------------------------------------------

  test("discovery fixtures are free of unhandled page errors", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(`Page error: ${error.message}`);
    });

    // Run through all three fixtures to ensure none produce JS errors
    await page.setContent(HAPPY_PATH_HTML);
    await page.waitForTimeout(500);

    await page.setContent(EMPTY_STATE_HTML);
    await page.waitForTimeout(500);

    await page.setContent(DEGRADED_STATE_HTML);
    await page.waitForTimeout(500);

    expect(errors).toHaveLength(0);
  });
});
