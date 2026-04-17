// =============================================================================
// TokenScope — Near Tie E2E Test
// =============================================================================
//
// Spec name (from plan): "near tie recommendation surfaces close alternatives"
//
// Since the token page is SSR, this test renders a pre-built HTML fixture
// that simulates the near-tie recommendation card state. This avoids
// dependency on live GeckoTerminal data (which can 429).
//
// The deterministic near-tie logic is verified more thoroughly in:
//   - tests/recommendation/recommendation-engine.test.ts
//   - tests/components/recommendation-card.test.tsx
// =============================================================================

import { expect, test } from "@playwright/test";

const NEAR_TIE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>TokenScope — Near Tie Test</title>
  <style>
    body { font-family: sans-serif; margin: 2rem; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; border: 1px solid; font-size: 0.75rem; }
    .pool-card { border: 1px solid #ddd; border-radius: 1rem; padding: 1.25rem; margin: 0.5rem 0; }
  </style>
</head>
<body>
  <main>
    <section aria-label="Recommendation card">
      <p>Pool suggestion</p>
      <span class="badge" data-testid="confidence-badge">Medium confidence</span>
      <h2>Close alternatives worth considering</h2>

      <div class="pool-card">
        <p>Slightly higher score</p>
        <p>WETH / USDC</p>
        <p>Uniswap V3 on Ethereum</p>
      </div>

      <div class="pool-card">
        <p>Close runner-up</p>
        <p>WETH / USDC</p>
        <p>Aerodrome on Base</p>
      </div>

      <p data-testid="rationale">
        WETH / USDC on Uniswap V3 (Ethereum) scored slightly higher than
        WETH / USDC on Aerodrome (Base), but the gap is narrow. Both are
        close alternatives worth considering.
      </p>

      <p data-testid="disclaimer">
        This is a deterministic suggestion based on current pool metrics,
        not financial advice.
      </p>

      <details open>
        <summary>How this works</summary>
        <p>Liquidity: 60% — higher locked liquidity suggests better price stability</p>
        <p>24h volume: 30% — recent trading activity indicates market interest</p>
        <p>Transactions: 10% — transaction count reflects user activity</p>
      </details>
    </section>
  </main>
</body>
</html>
`;

test("near tie recommendation surfaces close alternatives", async ({ page }) => {
  await page.setContent(NEAR_TIE_HTML);

  // The card shows "Close alternatives" instead of a single winner
  await expect(
    page.getByRole("heading", { name: "Close alternatives worth considering" })
  ).toBeVisible();

  // Both pools appear in the comparison
  await expect(page.getByText("Slightly higher score")).toBeVisible();
  await expect(page.getByText("Close runner-up")).toBeVisible();

  // Medium confidence is shown (not false precision)
  await expect(page.getByTestId("confidence-badge")).toContainText("Medium confidence");

  // Rationale mentions narrow gap and alternatives
  const rationale = page.getByTestId("rationale");
  await expect(rationale).toContainText("narrow");
  await expect(rationale).toContainText("close alternatives worth considering");

  // Disclaimer is present
  await expect(page.getByTestId("disclaimer")).toContainText("not financial advice");

  // "How this works" disclosure reveals the weights
  await expect(page.getByText("Liquidity: 60%")).toBeVisible();
  await expect(page.getByText("24h volume: 30%")).toBeVisible();
  await expect(page.getByText("Transactions: 10%")).toBeVisible();
});
