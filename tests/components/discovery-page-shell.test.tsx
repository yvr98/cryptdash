import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { DiscoveryPageShell } from "@/components/discover/discovery-page-shell";
import type { DiscoveryPageModel } from "@/lib/page-data/discovery";
import type { DataState } from "@/lib/page-data/token-detail";

afterEach(cleanup);

const APPROVED_COLUMNS = [
  "Pair",
  "DEX",
  "Chain",
  "Liquidity",
  "24h Vol",
  "Txs",
  "Freshness",
] as const;

const COMPLETE_DATA_STATE: DataState = {
  status: "complete",
  errors: [],
};

const UPSTREAM_ERROR_STATE: DataState = {
  status: "upstream_error",
  errors: [
    {
      category: "server_error",
      source: "geckoterminal",
      userMessage: "Trending pools could not be fully loaded.",
    },
  ],
};

const BASE_MODEL: DiscoveryPageModel = {
  rows: [
    {
      networkId: "eth",
      poolAddress: "0x0000000000000000000000000000000000000001",
      chainId: 1,
      pairLabel: "WETH / USDC",
      dexName: "Uniswap V3",
      liquidityUsd: 5_000_000,
      volume24hUsd: 500_000,
      transactions24h: 1_240,
      freshness: "New",
      poolCreatedAt: "2025-01-15T00:00:00Z",
    },
    {
      networkId: "base",
      poolAddress: "0x0000000000000000000000000000000000000002",
      chainId: 8453,
      pairLabel: "cbBTC / WETH",
      dexName: "Aerodrome",
      liquidityUsd: 1_250_000,
      volume24hUsd: 80_000,
      transactions24h: 340,
      freshness: "Recent",
      poolCreatedAt: "2025-01-10T12:00:00Z",
    },
  ],
  totalSupported: 2,
  pagesScanned: 1,
  capped: false,
  referenceTime: 1_736_932_800_000,
  emptyState: null,
};

describe("DiscoveryPageShell", () => {
  it("renders the canonical copy heading and description, approved columns, and row content", () => {
    render(
      <DiscoveryPageShell
        data={{
          ...BASE_MODEL,
          dataState: COMPLETE_DATA_STATE,
          copy: {
            title: "Explore trending pools across supported chains",
            description:
              "Discovery order is upstream-ranked. TokenScope keeps the original feed order, filters it to supported chains, and shows the latest available liquidity, volume, activity, and freshness signals.",
          },
        }}
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "Explore trending pools across supported chains",
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/Discovery order is upstream-ranked/i)).toBeInTheDocument();

    const headerCells = screen.getAllByRole("columnheader");
    const headerTexts = headerCells.map((cell) => cell.textContent?.trim());
    expect(headerTexts).toHaveLength(APPROVED_COLUMNS.length);

    for (const column of APPROVED_COLUMNS) {
      expect(headerTexts).toContain(column);
    }

    expect(screen.getAllByText("WETH / USDC").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Uniswap V3").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ethereum").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("New").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$5.00M").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("$500.0K").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("1,240").length).toBeGreaterThanOrEqual(1);
  });

  it("renders canonical empty-state copy from data.copy when rows are empty", () => {
    render(
      <DiscoveryPageShell
        data={{
          ...BASE_MODEL,
          rows: [],
          totalSupported: 0,
          emptyState: {
            reason: "no_supported_rows",
            hadUnsupportedRows: true,
          },
          dataState: COMPLETE_DATA_STATE,
          copy: {
            title: "No supported-chain pools in this snapshot",
            description:
              "Upstream discovery returned pools, but none mapped to TokenScope's supported chains.",
          },
        }}
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "No supported-chain pools in this snapshot",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/none mapped to TokenScope's supported chains/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders the degraded banner only when dataState.status is upstream_error", () => {
    const { rerender } = render(
      <DiscoveryPageShell
        data={{
          ...BASE_MODEL,
          dataState: COMPLETE_DATA_STATE,
          copy: {
            title: "Explore trending pools across supported chains",
            description:
              "Discovery order is upstream-ranked. TokenScope keeps the original feed order, filters it to supported chains, and shows the latest available liquidity, volume, activity, and freshness signals.",
          },
        }}
      />
    );

    expect(
      screen.queryByTestId("discover-upstream-error-banner")
    ).not.toBeInTheDocument();

    rerender(
      <DiscoveryPageShell
        data={{
          ...BASE_MODEL,
          dataState: UPSTREAM_ERROR_STATE,
          copy: {
            title: "Discovery data partially unavailable",
            description:
              "Some upstream discovery results could not be loaded. Showing available data only. Try refreshing in a moment.",
          },
        }}
      />
    );

    expect(
      screen.getByTestId("discover-upstream-error-banner")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Trending pools could not be fully loaded.")
    ).toBeInTheDocument();
  });
});
