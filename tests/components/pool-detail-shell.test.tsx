import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PoolDetailShell } from "@/components/pool/pool-detail-shell";
import type { PoolDetailPageData } from "@/lib/page-data/pool-detail";

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
  dataState: {
    status: "complete",
    errors: [],
  },
};

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
    expect(screen.getByText("$5.00M")).toBeInTheDocument();
    expect(screen.getByText("$500.0K")).toBeInTheDocument();
    expect(screen.getByText("1,240")).toBeInTheDocument();
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

});
