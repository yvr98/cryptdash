// =============================================================================
// TokenScope — Pools Table Rendering Test
// =============================================================================
//
// Deterministic component-level proof that:
//   1. The approved columns (Pair, DEX, Chain, Liquidity, 24h Volume, Txs,
//      24h Change) are the only table headers rendered.
//   2. At least one eligible row renders for valid eligible pool data.
//   3. The empty state renders when no eligible pools exist.
//
// No external network calls — uses fixture data from tests/fixtures/recommendation.
// =============================================================================

import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { PoolsTable } from "@/components/token/pools-table";
import { clearWinnerPools } from "@/tests/fixtures/recommendation";

afterEach(cleanup);

const APPROVED_COLUMNS = [
  "Pair",
  "DEX",
  "Chain",
  "Liquidity",
  "24h Vol",
  "Txs",
  "24h Δ",
] as const;

describe("PoolsTable rendering", () => {
  it("renders exactly the approved columns as table headers", () => {
    // In jsdom, both mobile cards and desktop table render (no CSS media queries)
    // so we check the desktop table headers specifically
    render(<PoolsTable pools={clearWinnerPools} />);

    const tables = screen.getAllByRole("table");
    expect(tables.length).toBe(1);
    const headerCells = screen.getAllByRole("columnheader");
    const headerTexts = headerCells.map((th) => th.textContent?.trim());

    expect(headerTexts).toHaveLength(APPROVED_COLUMNS.length);
    for (const col of APPROVED_COLUMNS) {
      expect(headerTexts).toContain(col);
    }
  });

  it("renders at least one eligible row for valid eligible pool data", () => {
    render(<PoolsTable pools={clearWinnerPools} />);

    const rows = screen.getAllByRole("row");
    // 1 header row + N data rows
    expect(rows.length).toBeGreaterThan(1);

    const dataRows = rows.slice(1);
    expect(dataRows.length).toBeGreaterThanOrEqual(1);

    // Verify first pool's unique data appears in the table
    const firstPool = clearWinnerPools[0]!;
    expect(screen.getAllByText(firstPool.dexName).length).toBeGreaterThanOrEqual(1);
    // pairLabel 'WETH / USDC' appears in multiple rows
    expect(screen.getAllByText(firstPool.pairLabel).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ethereum").length).toBeGreaterThanOrEqual(1);
  });

  it("renders chain name badge for each supported chain", () => {
    render(<PoolsTable pools={clearWinnerPools} />);

    // clearWinnerPools has chains 1 (Ethereum) and 8453 (Base)
    const ethereumBadges = screen.getAllByText("Ethereum");
    const baseBadges = screen.getAllByText("Base");
    expect(ethereumBadges.length).toBeGreaterThanOrEqual(1);
    expect(baseBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("renders formatted liquidity and volume values", () => {
    render(<PoolsTable pools={clearWinnerPools} />);

    // First pool: liquidityUsd=5_000_000 → "$5.00M"
    expect(screen.getAllByText("$5.00M").length).toBeGreaterThanOrEqual(1);
    // First pool: volume24hUsd=500_000 → "$500.0K"
    expect(screen.getAllByText("$500.0K").length).toBeGreaterThanOrEqual(1);
  });

  it("renders price change with sign", () => {
    render(<PoolsTable pools={clearWinnerPools} />);

    // First pool: priceChange24h=2.5 → "+2.50%"
    expect(screen.getAllByText("+2.50%").length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when no eligible pools exist", () => {
    render(<PoolsTable pools={[]} />);

    expect(screen.getByText("No eligible pools")).toBeInTheDocument();
    expect(
      screen.getByText(/No pools on supported chains meet/)
    ).toBeInTheDocument();

    // No table should be present in empty state
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });


  it("does not render extra columns beyond the approved set", () => {
    render(<PoolsTable pools={clearWinnerPools} />);

    const headerCells = screen.getAllByRole("columnheader");
    expect(headerCells).toHaveLength(7);

    // Explicitly check columns that must NOT appear
    expect(screen.queryByText("FDV")).not.toBeInTheDocument();
    expect(screen.queryByText("Market Cap")).not.toBeInTheDocument();
    expect(screen.queryByText("5m Change")).not.toBeInTheDocument();
    expect(screen.queryByText("1h Change")).not.toBeInTheDocument();
  });
  it("highlights the recommended pool row with Suggested badge", () => {
    render(
      <PoolsTable
        pools={clearWinnerPools}
        recommendedPoolAddress={clearWinnerPools[0]!.poolAddress}
      />
    );

    // ★ appears in both mobile card and desktop table row
    expect(screen.getAllByText("★").length).toBeGreaterThanOrEqual(1);
  });

  it("does not show star badge when no pool is recommended", () => {
    render(<PoolsTable pools={clearWinnerPools} />);

    expect(screen.queryAllByText("★")).toHaveLength(0);
  });
});
