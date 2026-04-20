// =============================================================================
// TokenScope — Pool Detail Page E2E Test
// =============================================================================
//
// Verifies real navigation paths into and out of pool detail pages.
// Covers the four required scenarios:
//   1. Discovery → pool detail (canonical URL, no coinId)
//   2. Pool detail rendering with backlink when coinId context exists
//   3. Direct-entry honesty (no backlink without coinId)
//   4. Direct-entry to non-existent pool (honest 404 behavior)
//
// Navigation-structure tests use deterministic ?fixture= mechanisms.
// Discovery navigation still uses /discover?fixture=happy. Token-detail → pool-detail
// proofs now use /token/ethereum?fixture=pool-link so SSR no longer depends on
// live upstream data to surface a pool link with coinId context.
//
// The deterministic shaping logic is verified more thoroughly in:
//   - tests/data/pool-detail-page-data.test.ts
//   - tests/components/pool-detail-shell.test.tsx
// =============================================================================

import { expect, test } from "@playwright/test";

const BASE = "http://127.0.0.1:3000";

async function discoverEthereumPoolUrl(page: import("@playwright/test").Page) {
  await page.goto(`${BASE}/token/ethereum?fixture=pool-link`, {
    waitUntil: "networkidle",
  });

  await expect(page.getByText("Pool comparison")).toBeVisible();

  const poolLink = page
    .getByRole("table")
    .locator('a[href*="/pool/"][href*="coinId=ethereum"]')
    .first();

  await expect(poolLink).toBeVisible();

  const href = await poolLink.getAttribute("href");
  expect(href).toBe(
    "/pool/eth/0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640?coinId=ethereum"
  );

  return new URL(href!, BASE).toString();
}

// ---------------------------------------------------------------------------
// 1. Discovery → pool detail navigation
// ---------------------------------------------------------------------------

test.describe("Pool detail — discovery navigation entry flow", () => {
  test("discovery pool link navigates to canonical pool URL without coinId", async ({
    page,
  }) => {
    await page.goto(`${BASE}/discover?fixture=happy`, {
      waitUntil: "networkidle",
    });

    // Desktop table link to the discovery fixture's first pool
    const table = page.getByRole("table");
    const poolLink = table.locator(
      'a[href="/pool/eth/0xaaa0001000000000000000000000000000000001"]'
    );
    await expect(poolLink).toBeVisible();
    await poolLink.click();

    // URL is canonical pool path
    await page.waitForURL(
      "**/pool/eth/0xaaa0001000000000000000000000000000000001",
      { timeout: 10000 }
    );
    await expect(page).toHaveURL(
      `${BASE}/pool/eth/0xaaa0001000000000000000000000000000000001`
    );

    // Discovery links never carry coinId
    await expect(page).not.toHaveURL(/coinId=/);
  });

  test("discovery pool link hrefs never carry coinId query parameter", async ({
    page,
  }) => {
    await page.goto(`${BASE}/discover?fixture=happy`, {
      waitUntil: "networkidle",
    });

    const poolLinks = page.locator('a[href*="/pool/"]');
    const count = await poolLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await poolLinks.nth(i).getAttribute("href");
      expect(href).not.toContain("coinId=");
    }
  });
});

test.describe("Pool detail — token detail navigation entry flow", () => {
  test("token detail pool link navigates to pool detail with coinId context", async ({
    page,
  }) => {
    const poolUrlWithCoinId = await discoverEthereumPoolUrl(page);

    await page.goto(poolUrlWithCoinId, { waitUntil: "networkidle" });

    await expect(page).toHaveURL(/\/pool\/[^/]+\/0x[0-9a-f]+\?coinId=ethereum$/i);
    await expect(page.getByText("Pool detail")).toBeVisible();
    await expect(page.getByRole("link", { name: /back to token/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Pool detail rendering — backlink present when coinId exists
// ---------------------------------------------------------------------------

test.describe("Pool detail — backlink with coinId context", () => {
  test("backlink to token page is present when coinId query context exists", async ({
    page,
  }) => {
    const poolUrlWithCoinId = await discoverEthereumPoolUrl(page);

    await page.goto(poolUrlWithCoinId, {
      waitUntil: "networkidle",
    });

    // The page must have loaded the pool detail shell (not a 404)
    await expect(page.getByText("Pool detail")).toBeVisible();

    // Backlink is visible and points to the canonical token page
    const backlink = page.getByRole("link", { name: /back to token/i });
    await expect(backlink).toBeVisible();
    await expect(backlink).toHaveAttribute("href", "/token/ethereum");
  });

  test("clicking backlink navigates to the canonical token page", async ({
    page,
  }) => {
    const poolUrlWithCoinId = await discoverEthereumPoolUrl(page);

    await page.goto(poolUrlWithCoinId, {
      waitUntil: "networkidle",
    });

    // Confirm pool detail shell rendered
    await expect(page.getByText("Pool detail")).toBeVisible();

    const backlink = page.getByRole("link", { name: /back to token/i });
    await expect(backlink).toBeVisible();
    await backlink.click();

    await page.waitForURL("**/token/ethereum", { timeout: 10000 });
    await expect(page).toHaveURL(`${BASE}/token/ethereum`);
  });
});

// ---------------------------------------------------------------------------
// 3. Direct-entry honesty — no backlink without coinId
// ---------------------------------------------------------------------------

test.describe("Pool detail — direct-entry honesty", () => {
  test("no backlink on direct entry without coinId context", async ({
    page,
  }) => {
    const poolUrlWithCoinId = await discoverEthereumPoolUrl(page);
    const directEntryUrl = new URL(poolUrlWithCoinId);

    directEntryUrl.search = "";

    await page.goto(directEntryUrl.toString(), { waitUntil: "networkidle" });

    // Pool detail shell rendered
    await expect(page.getByText("Pool detail")).toBeVisible();

    // No backlink when coinId is absent
    const backlink = page.getByRole("link", { name: /back to token/i });
    await expect(backlink).toHaveCount(0);
    await expect(
      page.getByText(
        "Opened directly from a pool link, so token page context is unavailable for this view."
      )
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Degraded / non-existent pool — honest 404 behavior
// ---------------------------------------------------------------------------

test.describe("Pool detail — direct-entry degraded state", () => {
  test("non-existent pool address returns honest 404 without crashing", async ({
    page,
  }) => {
    const fakePoolUrl =
      `${BASE}/pool/eth/0xdead000000000000000000000000000000000000`;

    const response = await page.goto(fakePoolUrl, {
      waitUntil: "networkidle",
    });

    // Server returns 404 — honest not-found behavior
    expect(response!.status()).toBe(404);

    await expect(
      page.getByRole("heading", { name: "We couldn't find that token or pool." })
    ).toBeVisible();
    await expect(
      page.getByText(/identifier may be wrong, or the resource may no longer be available/i)
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /search again/i })).toHaveAttribute(
      "href",
      "/"
    );

    // No backlink rendered (the pool detail shell never mounted)
    await expect(
      page.getByRole("link", { name: /back to token/i })
    ).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// No unhandled page errors across flows
// ---------------------------------------------------------------------------

test.describe("Pool detail — no unhandled errors", () => {
  test("pool detail page variants are free of unhandled page errors", async ({
    page,
  }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(`Page error: ${error.message}`);
    });

    const poolUrlWithCoinId = await discoverEthereumPoolUrl(page);
    const directEntryUrl = new URL(poolUrlWithCoinId);

    directEntryUrl.search = "";

    // Real pool with coinId
    await page.goto(poolUrlWithCoinId, {
      waitUntil: "networkidle",
    });

    // Real pool without coinId
    await page.goto(directEntryUrl.toString(), { waitUntil: "networkidle" });

    // Non-existent pool (404)
    await page.goto(
      `${BASE}/pool/eth/0xdead000000000000000000000000000000000000`,
      { waitUntil: "networkidle" }
    );

    expect(errors).toHaveLength(0);
  });
});
