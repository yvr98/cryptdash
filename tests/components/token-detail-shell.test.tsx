// =============================================================================
// CryptDash — Token Detail Shell Component Tests
// =============================================================================
//
// Focused component tests for TokenDetailShell:
// - Token header rendering (name, symbol, rank)
// - Price and market stats display
// - Upstream-error banner presence/absence
// - Fallback section for tokens without supported chains
// - Canonical route badge
// =============================================================================

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { TokenDetailShell } from "@/components/token/token-detail-shell";
import type { TokenDetailPageData } from "@/lib/page-data/token-detail";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeShellData(
  overrides?: Partial<TokenDetailPageData>,
): TokenDetailPageData {
  return {
    token: {
      coinId: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      marketCapRank: 1,
      marketData: {
        currentPriceUsd: 3000,
        priceChange24hPercent: 2.5,
        marketCap: 360_000_000_000,
        totalVolume24h: 18_000_000_000,
        circulatingSupply: 120_000_000,
        fullyDilutedValuation: 360_000_000_000,
      },
    },
    marketData: {
      currentPriceUsd: 3000,
      priceChange24hPercent: 2.5,
      marketCap: 360_000_000_000,
      totalVolume24h: 18_000_000_000,
      circulatingSupply: 120_000_000,
      fullyDilutedValuation: 360_000_000_000,
    },
    priceContext: { marketCapRank: 1 },
    supportedChains: [],
    availableSupportedChains: [],
    externalLinks: [
      { label: "CoinGecko", href: "https://www.coingecko.com/en/coins/ethereum" },
    ],
    fallback: null,
    eligiblePools: [],
    recommendation: {
      status: "insufficient_data",
      eligiblePools: [],
      confidence: "low",
      rationale: "Not enough data for a suggestion.",
    },
    dataState: { status: "complete", errors: [] },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TokenDetailShell", () => {
  it("renders token header with name, uppercased symbol, and rank badge", () => {
    render(<TokenDetailShell data={makeShellData()} />);

    expect(
      screen.getByRole("heading", { name: "Ethereum" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
  });

  it("renders current price and 24h change", () => {
    render(<TokenDetailShell data={makeShellData()} />);

    expect(screen.getByText("$3,000.00")).toBeInTheDocument();
    expect(screen.getByText("+2.50%")).toBeInTheDocument();
    expect(screen.getByText("24h")).toBeInTheDocument();
  });

  it("renders market stats grid labels", () => {
    render(<TokenDetailShell data={makeShellData()} />);

    expect(screen.getByText("Market Cap")).toBeInTheDocument();
    expect(screen.getByText("24h Volume")).toBeInTheDocument();
    expect(screen.getByText("FDV")).toBeInTheDocument();
    expect(screen.getByText("Circulating")).toBeInTheDocument();
  });

  it("renders upstream-error banner when data state is degraded", () => {
    render(
      <TokenDetailShell
        data={makeShellData({
          dataState: {
            status: "upstream_error",
            errors: [
              {
                category: "rate_limited",
                source: "coingecko",
                userMessage: "Upstream is rate-limiting requests.",
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByTestId("upstream-error-banner")).toBeInTheDocument();
    expect(
      screen.getByText("Upstream is rate-limiting requests."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Showing available data. Try refreshing in a moment."),
    ).toBeInTheDocument();
  });

  it("does not render upstream-error banner when data state is complete", () => {
    render(<TokenDetailShell data={makeShellData()} />);

    expect(screen.queryByTestId("upstream-error-banner")).not.toBeInTheDocument();
  });

  it("renders fallback section when no supported chains are available", () => {
    render(
      <TokenDetailShell
        data={makeShellData({
          fallback: {
            title: "No supported chain mappings",
            description:
              "This token was found on CoinGecko but doesn't have a contract mapping on any supported chain.",
          },
        })}
      />,
    );

    expect(
      screen.getByText("No supported chain mappings"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/doesn't have a contract mapping/),
    ).toBeInTheDocument();
  });

  it("does not render fallback section when fallback is null", () => {
    render(<TokenDetailShell data={makeShellData()} />);

    expect(
      screen.queryByText("No supported chains"),
    ).not.toBeInTheDocument();
  });

  it("renders route badge with canonical token path", () => {
    render(<TokenDetailShell data={makeShellData()} />);

    const badge = screen.getByText("/token/ethereum");
    expect(badge).toBeInTheDocument();
    expect(badge.closest("a")).toHaveAttribute("href", "/token/ethereum");
  });

  it("renders external research links", () => {
    render(<TokenDetailShell data={makeShellData()} />);

    expect(
      screen.getByRole("link", { name: /CoinGecko/ }),
    ).toHaveAttribute(
      "href",
      "https://www.coingecko.com/en/coins/ethereum",
    );
  });

  it("renders em-dash for null market data values", () => {
    render(
      <TokenDetailShell
        data={makeShellData({
          marketData: {
            currentPriceUsd: null,
            priceChange24hPercent: null,
            marketCap: null,
            totalVolume24h: null,
            circulatingSupply: null,
            fullyDilutedValuation: null,
          },
        })}
      />,
    );

    // Multiple stats show em-dash for null values
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });
});
