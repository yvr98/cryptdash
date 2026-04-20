// =============================================================================
// TokenScope — Pool Route Polish E2E Test
// =============================================================================
//
// Focused Playwright spec proving pool route polish:
// - Pool detail renders via real token page navigation with backlink
// - Pool route metadata is reflected in the browser page title
// - Not-found pools show honest state (shared screen or degraded, both valid)
// - No unhandled page errors across pool route states
//
// Happy-path test navigates from /token/ethereum (real CoinGecko data)
// to a pool detail page. Structural assertions verify layout without
// coupling to specific data values.
// Loading.tsx is covered by unit tests in app-router-fallbacks.test.tsx.
//
// Not-found test is conditional: when GeckoTerminal returns 404 the shared
// not-found screen renders; when it returns a non-404 error the pool detail
// shell renders in degraded mode. The test proves both paths are honest
// (no crash, no error boundary).
//

import { expect, test } from "@playwright/test";

const BASE = "http://127.0.0.1:3000";
const FAKE_POOL =
  "0xdead000000000000000000000000000000000000";

async function navigateToPoolViaTokenPage(
  page: import("@playwright/test").Page,
) {
  await page.goto(`${BASE}/token/ethereum`, {
    waitUntil: "networkidle",
  });

  await expect(page.getByText("Pool comparison")).toBeVisible();

  const poolLink = page
    .getByRole("table")
    .locator('a[href*="/pool/"][href*="coinId=ethereum"]')
    .first();
  await expect(poolLink).toBeVisible();

  return poolLink;
}

// ---------------------------------------------------------------------------
// 1. Happy path — pool detail from token page navigation
// ---------------------------------------------------------------------------

test.describe("Pool route polish — happy path", () => {
  test("pool detail renders with structural elements and backlink", async ({
    page,
  }) => {
    const poolLink = await navigateToPoolViaTokenPage(page);
    await poolLink.click();

    await page.waitForURL(`**/pool/**`, {
      timeout: 15000,
    });

    // Pool detail label
    await expect(page.getByText("Pool detail")).toBeVisible();

    // Heading present (pair label or fallback)
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible();

    // Structural metric labels always present
    await expect(page.getByText("Liquidity")).toBeVisible();
    await expect(page.getByText("24h Vol")).toBeVisible();
    await expect(page.getByText("24h Txs")).toBeVisible();

    // Backlink present (navigated with coinId context)
    await expect(
      page.getByRole("link", { name: /back to token/i }),
    ).toBeVisible();

    // Route-level metadata: generateMetadata produces a title containing
    // the pool subtitle marker (" — TokenScope Pool"). This proves the
    // pool route export path generates real metadata, not just the layout.
    const title = await page.title();
    expect(title).toContain("TokenScope Pool");
  });
});
test.describe("Pool route polish — not-found reuse", () => {
  test("non-existent pool shows honest state (not-found or degraded)", async ({
    page,
  }) => {
    const fakePoolUrl = `${BASE}/pool/eth/${FAKE_POOL}`;

    const response = await page.goto(fakePoolUrl, {
      waitUntil: "networkidle",
    });

    const status = response!.status();

    if (status === 404) {
      // Shared not-found screen — proves reuse of app/not-found.tsx
      await expect(
        page.getByRole("heading", {
          name: "We couldn't find that token or pool.",
        }),
      ).toBeVisible();
      await expect(
        page.getByText(/link may be outdated/i),
      ).toBeVisible();

      // Recovery links — shared screen
      await expect(
        page.getByRole("link", { name: /search again/i }),
      ).toHaveAttribute("href", "/");
      await expect(
        page.getByRole("link", { name: /browse discovery/i }),
      ).toHaveAttribute("href", "/discover");

      // No backlink rendered (pool detail shell never mounted)
      await expect(
        page.getByRole("link", { name: /back to token/i }),
      ).toHaveCount(0);
    } else {
      // Degraded state — upstream returned non-404 error
      // Page still renders honestly without crashing
      await expect(page.locator("main")).toBeVisible();
      // No hard error boundary screen
      await expect(
        page.getByRole("heading", {
          name: "This view couldn't be rendered right now.",
        }),
      ).toHaveCount(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. No unhandled page errors
// ---------------------------------------------------------------------------

test.describe("Pool route polish — error hygiene", () => {
  test("pool route variants are free of unhandled page errors", async ({
    page,
  }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(`Page error: ${error.message}`);
    });

    // Pool detail via token page navigation
    const poolLink = await navigateToPoolViaTokenPage(page);
    await poolLink.click();
    await page.waitForURL("**/pool/**", { timeout: 15000 });

    // Direct entry to a known fake pool
    await page.goto(
      `${BASE}/pool/eth/${FAKE_POOL}`,
      { waitUntil: "networkidle" },
    );

    expect(errors).toHaveLength(0);
  });
});
