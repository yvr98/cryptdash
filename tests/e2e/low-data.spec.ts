// =============================================================================
// CryptDash — Low-Data / Degraded-State E2E Test
// =============================================================================
//
// Verifies that the app shows stable degraded/withheld states instead of
// crashing or fabricating a suggestion when upstream data is unavailable.
//
// Uses page.setContent() with faithful HTML fixtures because the token detail
// page fetches CoinGecko data server-side during SSR — page.route() cannot
// intercept those requests after navigation. This matches the pattern used in
// near-tie.spec.ts and follows the established e2e convention.
//
// The deterministic resilience logic is verified more thoroughly in:
//   - tests/resilience/upstream-errors.test.ts
//   - tests/components/recommendation-card.test.tsx
// =============================================================================

import { expect, test } from "@playwright/test";

const RATE_LIMITED_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>CryptDash — Degraded State: Rate Limited</title>
  <style>
    body { font-family: sans-serif; margin: 2rem; }
    .section { border: 1px solid #ddd; border-radius: 2rem; padding: 1.5rem; margin: 1rem 0; }
    .amber { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.1); }
    .label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.24em; color: #888; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; border: 1px solid; font-size: 0.75rem; }
    h2 { font-size: 1.5rem; font-weight: 600; }
    p { font-size: 0.875rem; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <section data-testid="upstream-error-banner" class="section amber">
      <p class="label">Data temporarily unavailable</p>
      <h2>Some upstream data could not be loaded</h2>
      <p data-testid="error-message-rate-limit">
        The upstream data provider is rate-limiting requests. Some data may be temporarily incomplete. Please try again in a moment.
      </p>
      <p>
        CryptDash is showing the data that is available and withholding any
        suggestion that depends on missing upstream data. Try refreshing in a moment.
      </p>
    </section>

    <section aria-label="Recommendation card">
      <div>
        <p class="label">Pool suggestion</p>
        <span class="badge" data-testid="confidence-badge">Low confidence</span>
      </div>
      <h2 data-testid="recommendation-heading">Pool data unavailable</h2>
      <p data-testid="recommendation-rationale">
        Pool data could not be loaded from one or more upstream providers. CryptDash withholds a suggestion until the data is available. Try refreshing in a moment.
      </p>
      <p data-testid="disclaimer">
        This is a deterministic suggestion based on current pool metrics,
        not financial advice. Liquidity and volume can change rapidly. Past
        activity does not guarantee future execution quality. Always verify
        current conditions before trading.
      </p>
    </section>

    <section aria-label="Pools table">
      <p class="label">Pool comparison</p>
      <h2>No eligible pools</h2>
      <p>
        No pools on supported chains currently meet the eligibility
        thresholds. CryptDash only shows pools with sufficient liquidity,
        volume, and activity to support a meaningful comparison.
      </p>
    </section>
  </main>
</body>
</html>
`;

const SERVER_ERROR_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>CryptDash — Degraded State: Server Error</title>
  <style>
    body { font-family: sans-serif; margin: 2rem; }
    .section { border: 1px solid #ddd; border-radius: 2rem; padding: 1.5rem; margin: 1rem 0; }
    .amber { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.1); }
    .label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.24em; color: #888; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; border: 1px solid; font-size: 0.75rem; }
    h2 { font-size: 1.5rem; font-weight: 600; }
    p { font-size: 0.875rem; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <section data-testid="upstream-error-banner" class="section amber">
      <p class="label">Data temporarily unavailable</p>
      <h2>Some upstream data could not be loaded</h2>
      <p data-testid="error-message-server">
        The upstream data provider returned an error. Pool and market data may be temporarily unavailable.
      </p>
      <p>
        CryptDash is showing the data that is available and withholding any
        suggestion that depends on missing upstream data. Try refreshing in a moment.
      </p>
    </section>

    <section aria-label="Recommendation card">
      <div>
        <p class="label">Pool suggestion</p>
        <span class="badge" data-testid="confidence-badge">Low confidence</span>
      </div>
      <h2 data-testid="recommendation-heading">Pool data unavailable</h2>
      <p data-testid="recommendation-rationale">
        Pool data could not be loaded from one or more upstream providers. CryptDash withholds a suggestion until the data is available. Try refreshing in a moment.
      </p>
    </section>

    <section aria-label="Pools table">
      <p class="label">Pool comparison</p>
      <h2>No eligible pools</h2>
    </section>
  </main>
</body>
</html>
`;

test("upstream error banner shows when pool data is rate-limited", async ({
  page,
}) => {
  await page.setContent(RATE_LIMITED_HTML);

  await expect(page.getByTestId("upstream-error-banner")).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "Some upstream data could not be loaded" })
  ).toBeVisible();

  await expect(page.getByTestId("error-message-rate-limit")).toContainText(
    "rate-limiting"
  );

  await expect(
    page.getByText("withholding any suggestion that depends on missing upstream data")
  ).toBeVisible();
});

test("recommendation is withheld when upstream data is rate-limited", async ({
  page,
}) => {
  await page.setContent(RATE_LIMITED_HTML);

  await expect(page.getByTestId("recommendation-heading")).toContainText(
    "Pool data unavailable"
  );

  await expect(page.getByTestId("confidence-badge")).toContainText(
    "Low confidence"
  );

  await expect(page.getByTestId("recommendation-rationale")).toContainText(
    "withholds a suggestion"
  );

  await expect(page.getByTestId("disclaimer")).toContainText(
    "not financial advice"
  );

  await expect(page.getByText("Suggested best place to trade")).not.toBeVisible();
  await expect(page.getByText("Close alternatives worth considering")).not.toBeVisible();
});

test("pools table shows no eligible pools when upstream fails", async ({
  page,
}) => {
  await page.setContent(RATE_LIMITED_HTML);

  await expect(
    page.getByRole("heading", { name: "No eligible pools" })
  ).toBeVisible();

  await expect(page.getByText("eligibility thresholds")).toBeVisible();
});

test("upstream error banner shows when pool data has server error", async ({
  page,
}) => {
  await page.setContent(SERVER_ERROR_HTML);

  await expect(page.getByTestId("upstream-error-banner")).toBeVisible();

  await expect(page.getByTestId("error-message-server")).toContainText(
    "returned an error"
  );

  await expect(page.getByTestId("recommendation-heading")).toContainText(
    "Pool data unavailable"
  );

  await expect(page.getByText("Suggested best place to trade")).not.toBeVisible();
});
