import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PoolDetailShell } from "@/components/pool/pool-detail-shell";
import type { PoolDetailHistoryCard, PoolDetailPageData } from "@/lib/page-data/pool-detail";

afterEach(cleanup);

const BASE_DATA: PoolDetailPageData = {
  pool: {
    poolAddress: "0x1111111111111111111111111111111111111111",
    networkId: "eth",
    chainId: 1,
    dexName: "Uniswap V3",
    pairLabel: "WETH / USDC",
    baseTokenPriceUsd: 3500.005,
    quoteTokenPriceUsd: 0.999945,
    liquidityUsd: 5_000_000,
    volume24hUsd: 500_000,
    transactions24h: 1_240,
    priceChange24h: 2.5,
    poolCreatedAt: "2025-01-15T00:00:00Z",
  },
  freshness: "New",
  backlink: {
    coinId: "ethereum",
    tokenPath: "/token/ethereum",
  },
  history: {
    state: "ready",
    cards: [
      {
        label: "Liquidity",
        state: "ready",
        latestValue: 5_000_000,
        delta: 250_000,
        points: [
          { timestamp: "2026-04-21T00:00:00Z", value: 4_750_000 },
          { timestamp: "2026-04-21T12:00:00Z", value: 4_900_000 },
          { timestamp: "2026-04-22T00:00:00Z", value: 5_000_000 },
        ],
      },
      {
        label: "24h Vol",
        state: "ready",
        latestValue: 500_000,
        delta: 50_000,
        points: [
          { timestamp: "2026-04-21T00:00:00Z", value: 450_000 },
          { timestamp: "2026-04-21T12:00:00Z", value: 475_000 },
          { timestamp: "2026-04-22T00:00:00Z", value: 500_000 },
        ],
      },
      {
        label: "24h Txs",
        state: "ready",
        latestValue: 1_240,
        delta: 140,
        points: [
          { timestamp: "2026-04-21T00:00:00Z", value: 1_100 },
          { timestamp: "2026-04-21T12:00:00Z", value: 1_180 },
          { timestamp: "2026-04-22T00:00:00Z", value: 1_240 },
        ],
      },
    ],
  },
  dataState: {
    status: "complete",
    errors: [],
  },
};

function makeReadyCard(
  label: PoolDetailHistoryCard["label"],
  latestValue: number,
  delta: number,
): PoolDetailHistoryCard {
  return {
    label,
    state: "ready",
    latestValue,
    delta,
    points: [
      { timestamp: "2026-04-21T00:00:00Z", value: latestValue - delta },
      { timestamp: "2026-04-21T12:00:00Z", value: latestValue - delta / 2 },
      { timestamp: "2026-04-22T00:00:00Z", value: latestValue },
    ],
  };
}

function makeSparseCard(
  label: PoolDetailHistoryCard["label"],
  latestValue: number | null = null,
): PoolDetailHistoryCard {
  return {
    label,
    state: "sparse",
    latestValue,
    delta: null,
    points:
      latestValue !== null
        ? [{ timestamp: "2026-04-22T00:00:00Z", value: latestValue }]
        : [],
  };
}

describe("PoolDetailShell", () => {
  it("renders the required pool header and market fields from the page model", () => {
    render(<PoolDetailShell data={BASE_DATA} />);

    expect(
      screen.getByRole("heading", { name: "WETH / USDC" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Uniswap V3").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ethereum").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("eth").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("New").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Market history")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Last 24 hours of stored liquidity, volume, and transaction activity for this pool."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText("$5.00M").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$500.0K").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("1,240").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("+2.50%")).toBeInTheDocument();
    expect(screen.getByText("$3,500.005")).toBeInTheDocument();
    expect(screen.getByText("$0.999945")).toBeInTheDocument();
  });

  it("renders an explicit back-to-token link only when coinId context exists", () => {
    const { rerender } = render(<PoolDetailShell data={BASE_DATA} />);

    expect(
      screen.getByRole("link", { name: /back to token/i })
    ).toHaveAttribute("href", "/token/ethereum");

    rerender(
      <PoolDetailShell
        data={{
          ...BASE_DATA,
          backlink: null,
        }}
      />
    );

    expect(
      screen.queryByRole("link", { name: /back to token/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Opened directly from a pool link, so token page context is unavailable for this view."
      )
    ).toBeInTheDocument();
  });

  it("renders the degraded-state banner and keeps unavailable fields honest", () => {
    render(
      <PoolDetailShell
        data={{
          pool: {
            poolAddress: "0x2222222222222222222222222222222222222222",
            networkId: "base",
            chainId: 8453,
            dexName: "",
            pairLabel: "",
            baseTokenPriceUsd: null,
            quoteTokenPriceUsd: null,
            liquidityUsd: null,
            volume24hUsd: null,
            transactions24h: null,
            priceChange24h: null,
            poolCreatedAt: null,
          },
          freshness: "Unknown",
          backlink: null,
          history: {
            state: "unavailable",
            cards: [
              {
                label: "Liquidity",
                state: "sparse",
                latestValue: null,
                delta: null,
                points: [],
              },
              {
                label: "24h Vol",
                state: "sparse",
                latestValue: null,
                delta: null,
                points: [],
              },
              {
                label: "24h Txs",
                state: "sparse",
                latestValue: null,
                delta: null,
                points: [],
              },
            ],
          },
          dataState: {
            status: "upstream_error",
            errors: [
              {
                category: "server_error",
                source: "geckoterminal",
                userMessage: "Pool data could not be fully loaded.",
              },
            ],
          },
        }}
      />
    );

    expect(screen.getByTestId("upstream-error-banner")).toBeInTheDocument();
    expect(
      screen.getByText("Pool data could not be fully loaded.")
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pool unavailable" })).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(6);
    expect(
      screen.queryByRole("link", { name: /back to token/i })
    ).not.toBeInTheDocument();
  });

  it("shows networkId as chain name when chainId is null (unsupported network)", () => {
    render(
      <PoolDetailShell
        data={{
          ...BASE_DATA,
          pool: {
            ...BASE_DATA.pool,
            chainId: null,
            networkId: "solana",
          },
        }}
      />
    );

    // resolveChainName falls back to networkId when chainId is null
    expect(screen.getAllByText("solana").length).toBeGreaterThanOrEqual(1);
    // Should not render a supported chain name like "Ethereum"
    expect(screen.queryByText("Ethereum")).not.toBeInTheDocument();
  });

  it("renders token prices section with real values", () => {
    render(<PoolDetailShell data={BASE_DATA} />);

    // BASE_DATA has baseTokenPriceUsd=3500.005 and quoteTokenPriceUsd=0.999945
    expect(screen.getByText("$3,500.005")).toBeInTheDocument();
    expect(screen.getByText("$0.999945")).toBeInTheDocument();
  });

  it("renders em-dash for null token prices", () => {
    render(
      <PoolDetailShell
        data={{
          ...BASE_DATA,
          pool: {
            ...BASE_DATA.pool,
            baseTokenPriceUsd: null,
            quoteTokenPriceUsd: null,
          },
        }}
      />
    );

    // Token prices section renders — for null values
    // The em-dash appears in multiple metric cards for nulls
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("renders negative price change with minus sign", () => {
    render(
      <PoolDetailShell
        data={{
          ...BASE_DATA,
          pool: {
            ...BASE_DATA.pool,
            priceChange24h: -3.75,
          },
        }}
      />
    );

    expect(screen.getByText("-3.75%")).toBeInTheDocument();
  });

  it("renders all four freshness badge labels", () => {
    const { rerender } = render(
      <PoolDetailShell
        data={{ ...BASE_DATA, freshness: "New" }}
      />
    );
    expect(screen.getAllByText("New").length).toBeGreaterThanOrEqual(1);

    rerender(<PoolDetailShell data={{ ...BASE_DATA, freshness: "Recent" }} />);
    expect(screen.getAllByText("Recent").length).toBeGreaterThanOrEqual(1);

    rerender(<PoolDetailShell data={{ ...BASE_DATA, freshness: "Established" }} />);
    expect(screen.getAllByText("Established").length).toBeGreaterThanOrEqual(1);

    rerender(<PoolDetailShell data={{ ...BASE_DATA, freshness: "Unknown" }} />);
    expect(screen.getAllByText("Unknown").length).toBeGreaterThanOrEqual(1);
  });

  describe("Market history rendering", () => {
    it("ready state: renders latest values, signed deltas, and sparkline SVGs in fixed three-card order", () => {
      const { container } = render(<PoolDetailShell data={BASE_DATA} />);
      const text = container.textContent ?? "";

      // Section placement: Market history sits between live metrics (DEX) and Token prices
      const dexPos = text.indexOf("DEX");
      const historyPos = text.indexOf("Market history");
      const pricesPos = text.indexOf("Token prices");
      expect(historyPos).toBeGreaterThan(dexPos);
      expect(pricesPos).toBeGreaterThan(historyPos);

      // Section title and supporting copy
      expect(screen.getByText("Market history")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Last 24 hours of stored liquidity, volume, and transaction activity for this pool."
        )
      ).toBeInTheDocument();

      // No section-level sparse or unavailable copy for ready state
      expect(
        screen.queryByText(
          "History is still building for this pool. Check back after more snapshots are collected."
        )
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          "Stored history is temporarily unavailable for this pool. Try refreshing in a moment."
        )
      ).not.toBeInTheDocument();

      // Three-card order: Liquidity -> 24h Vol -> 24h Txs after "Market history"
      const liqPos = text.indexOf("Liquidity", historyPos);
      const volPos = text.indexOf("24h Vol", historyPos);
      const txsPos = text.indexOf("24h Txs", historyPos);
      expect(liqPos).toBeGreaterThan(historyPos);
      expect(volPos).toBeGreaterThan(liqPos);
      expect(txsPos).toBeGreaterThan(volPos);

      // Ready card: latest values (also appear in live metrics, so >= 2 occurrences)
      expect(screen.getAllByText("$5.00M").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("$500.0K").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("1,240").length).toBeGreaterThanOrEqual(2);

      // Ready card: signed absolute deltas
      expect(screen.getByText("+$250.0K")).toBeInTheDocument();
      expect(screen.getByText("+$50.0K")).toBeInTheDocument();
      expect(screen.getByText("+140")).toBeInTheDocument();

      // Ready card: sparkline SVG presence (one per ready card)
      expect(container.querySelectorAll("svg")).toHaveLength(3);

      // Non-regression: header, backlink, token prices, no upstream banner
      expect(
        screen.getByRole("heading", { name: "WETH / USDC" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /back to token/i })
      ).toHaveAttribute("href", "/token/ethereum");
      expect(screen.getByText("$3,500.005")).toBeInTheDocument();
      expect(screen.getByText("$0.999945")).toBeInTheDocument();
      expect(screen.queryByTestId("upstream-error-banner")).not.toBeInTheDocument();
    });

    it("all-sparse state: shows per-card sparse copy with latest values when available, without ready deltas or sparklines, plus section-level sparse copy", () => {
      const sparseData: PoolDetailPageData = {
        ...BASE_DATA,
        history: {
          state: "sparse",
          cards: [
            makeSparseCard("Liquidity", 4_800_000),
            makeSparseCard("24h Vol", null),
            makeSparseCard("24h Txs", 900),
          ],
        },
      };

      const { container } = render(<PoolDetailShell data={sparseData} />);

      // Section-level sparse copy driven by history.state === "sparse"
      expect(
        screen.getByText(
          "History is still building for this pool. Check back after more snapshots are collected."
        )
      ).toBeInTheDocument();

      // No section-level unavailable copy
      expect(
        screen.queryByText(
          "Stored history is temporarily unavailable for this pool. Try refreshing in a moment."
        )
      ).not.toBeInTheDocument();

      // All three cards render "History still building" regardless of latestValue presence
      expect(screen.getAllByText("History still building")).toHaveLength(3);

      // No sparkline SVGs for sparse cards
      expect(container.querySelectorAll("svg")).toHaveLength(0);

      // Sparse cards keep the primary value visible when latestValue exists
      expect(screen.getByText("$4.80M")).toBeInTheDocument();
      expect(screen.getByText("900")).toBeInTheDocument();

      // Sparse cards still omit ready-only deltas
      expect(screen.queryByText("+$250.0K")).not.toBeInTheDocument();
      expect(screen.queryByText("+900")).not.toBeInTheDocument();

      // Non-regression: header and token prices still render
      expect(
        screen.getByRole("heading", { name: "WETH / USDC" })
      ).toBeInTheDocument();
      expect(screen.getByText("$3,500.005")).toBeInTheDocument();
    });

    it("unavailable state: shows unavailable copy in all card slots and section-level unavailable copy", () => {
      const unavailableData: PoolDetailPageData = {
        ...BASE_DATA,
        history: {
          state: "unavailable",
          cards: [
            makeSparseCard("Liquidity"),
            makeSparseCard("24h Vol"),
            makeSparseCard("24h Txs"),
          ],
        },
      };

      const { container } = render(<PoolDetailShell data={unavailableData} />);

      // Section-level unavailable copy driven by history.state === "unavailable"
      expect(
        screen.getByText(
          "Stored history is temporarily unavailable for this pool. Try refreshing in a moment."
        )
      ).toBeInTheDocument();

      // No section-level sparse copy
      expect(
        screen.queryByText(
          "History is still building for this pool. Check back after more snapshots are collected."
        )
      ).not.toBeInTheDocument();

      // All three cards show "History unavailable" despite per-card state being "sparse"
      // This proves isSectionUnavailable overrides per-card state
      expect(screen.getAllByText("History unavailable")).toHaveLength(3);

      // No sparkline SVGs
      expect(container.querySelectorAll("svg")).toHaveLength(0);

      // Card labels still render in both live metrics and history cards
      expect(screen.getAllByText("Liquidity").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("24h Vol").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("24h Txs").length).toBeGreaterThanOrEqual(2);

      // Non-regression: header and token prices still render correctly
      expect(
        screen.getByRole("heading", { name: "WETH / USDC" })
      ).toBeInTheDocument();
      expect(screen.getByText("$3,500.005")).toBeInTheDocument();
      expect(screen.getByText("$0.999945")).toBeInTheDocument();
    });

    it("mixed ready/sparse cards: ready cards render value/delta/sparkline, sparse cards render value plus sparse copy only", () => {
      const mixedData: PoolDetailPageData = {
        ...BASE_DATA,
        history: {
          state: "ready", // at least one card is ready
          cards: [
            makeReadyCard("Liquidity", 5_000_000, 250_000),
            makeSparseCard("24h Vol", 450_000), // sparse despite having latestValue
            makeReadyCard("24h Txs", 1_240, 140),
          ],
        },
      };

      const { container } = render(<PoolDetailShell data={mixedData} />);
      const text = container.textContent ?? "";

      // Section state is "ready" -> no section-level sparse or unavailable copy
      expect(
        screen.queryByText(
          "History is still building for this pool. Check back after more snapshots are collected."
        )
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          "Stored history is temporarily unavailable for this pool. Try refreshing in a moment."
        )
      ).not.toBeInTheDocument();

      // Three-card order preserved: Liquidity -> 24h Vol -> 24h Txs
      const historyPos = text.indexOf("Market history");
      const liqPos = text.indexOf("Liquidity", historyPos);
      const volPos = text.indexOf("24h Vol", historyPos);
      const txsPos = text.indexOf("24h Txs", historyPos);
      expect(liqPos).toBeGreaterThan(historyPos);
      expect(volPos).toBeGreaterThan(liqPos);
      expect(txsPos).toBeGreaterThan(volPos);

      // Ready cards (Liquidity, 24h Txs): signed deltas present
      expect(screen.getByText("+$250.0K")).toBeInTheDocument();
      expect(screen.getByText("+140")).toBeInTheDocument();

      // Only 2 SVG sparklines for the 2 ready cards, not the sparse card
      expect(container.querySelectorAll("svg")).toHaveLength(2);

      // Sparse card (24h Vol): shows latest value and sparse copy, but no ready-only delta/SVG
      // Proves rendering follows card.state, not the presence of latestValue
      expect(screen.getByText("$450.0K")).toBeInTheDocument();
      expect(screen.getByText("History still building")).toBeInTheDocument();
      expect(screen.queryByText("+$50.0K")).not.toBeInTheDocument();

      // Non-regression: header, backlink, token prices
      expect(
        screen.getByRole("heading", { name: "WETH / USDC" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /back to token/i })
      ).toHaveAttribute("href", "/token/ethereum");
      expect(screen.getByText("$3,500.005")).toBeInTheDocument();
    });
  });

});
