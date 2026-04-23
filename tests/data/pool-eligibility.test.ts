// =============================================================================
// CryptDash — Pool Eligibility Test
// =============================================================================
//
// Spec name (from plan): "filters out pools that fail v1 eligibility thresholds"
//
// Eligibility rules (frozen defaults):
//   - liquidity_usd >= 50000
//   - volume_24h_usd >= 5000
//   - transactions_24h >= 20
//   - non-null DEX, pool address, pair label, and chain identifier
//
// Implementation lives in lib/recommendation/eligibility.ts.
// Fixtures live in tests/fixtures/recommendation.ts.
// =============================================================================

import { describe, it, expect, test } from "vitest";

import { isEligible, filterEligible } from "@/lib/recommendation/eligibility";
import type { PoolCandidate } from "@/lib/types";
import {
  clearWinnerPools,
  ineligiblePools,
  insufficientDataPools,
  mixedEligibilityPools,
} from "@/tests/fixtures/recommendation";

function makePool(overrides: Partial<PoolCandidate> = {}): PoolCandidate {
  return {
    poolAddress: "0x0000000000000000000000000000000000000001",
    chainId: 1,
    dexName: "TestDEX",
    pairLabel: "TKN / USDC",
    liquidityUsd: 100_000,
    volume24hUsd: 10_000,
    transactions24h: 50,
    priceChange24h: 1.5,
    ...overrides,
  };
}

describe("filters out pools that fail v1 eligibility thresholds", () => {
  test("rejects pools with liquidity_usd < 50000", () => {
    const pool = makePool({ liquidityUsd: 49_999 });
    expect(isEligible(pool)).toBe(false);
  });

  test("rejects pools with volume_24h_usd < 5000", () => {
    const pool = makePool({ volume24hUsd: 4_999 });
    expect(isEligible(pool)).toBe(false);
  });

  test("rejects pools with transactions_24h < 20", () => {
    const pool = makePool({ transactions24h: 19 });
    expect(isEligible(pool)).toBe(false);
  });

  test("rejects pools with null required metrics", () => {
    expect(isEligible(makePool({ liquidityUsd: null }))).toBe(false);
    expect(isEligible(makePool({ volume24hUsd: null }))).toBe(false);
    expect(isEligible(makePool({ transactions24h: null }))).toBe(false);
  });

  test("keeps pools that meet all thresholds", () => {
    const pool = makePool({
      liquidityUsd: 50_000,
      volume24hUsd: 5_000,
      transactions24h: 20,
    });
    expect(isEligible(pool)).toBe(true);
  });

  test("filters mixed pool set to only eligible candidates", () => {
    const eligible = filterEligible(mixedEligibilityPools);
    expect(eligible.length).toBe(clearWinnerPools.length);
    for (const pool of eligible) {
      expect(pool.liquidityUsd!).toBeGreaterThanOrEqual(50_000);
      expect(pool.volume24hUsd!).toBeGreaterThanOrEqual(5_000);
      expect(pool.transactions24h!).toBeGreaterThanOrEqual(20);
    }
  });

  it("fixture: clearWinnerPools all pass eligibility", () => {
    const eligible = filterEligible(clearWinnerPools);
    expect(eligible).toHaveLength(clearWinnerPools.length);
  });

  it("fixture: ineligiblePools all fail eligibility", () => {
    const eligible = filterEligible(ineligiblePools);
    expect(eligible).toHaveLength(0);
  });

  it("fixture: insufficientDataPools all fail eligibility (null metrics)", () => {
    const eligible = filterEligible(insufficientDataPools);
    expect(eligible).toHaveLength(0);
  });

  it("fixture: mixedEligibilityPools contains both eligible and ineligible", () => {
    expect(mixedEligibilityPools.length).toBeGreaterThan(
      clearWinnerPools.length
    );
  });

  it("exact boundary values pass (>= threshold)", () => {
    const boundaryPool = makePool({
      liquidityUsd: 50_000,
      volume24hUsd: 5_000,
      transactions24h: 20,
    });
    expect(isEligible(boundaryPool)).toBe(true);
  });

  it("just below each boundary fails", () => {
    expect(isEligible(makePool({ liquidityUsd: 49_999.99 }))).toBe(false);
    expect(isEligible(makePool({ volume24hUsd: 4_999.99 }))).toBe(false);
    expect(isEligible(makePool({ transactions24h: 19 }))).toBe(false);
  });

  it("filterEligible returns empty array for empty input", () => {
    expect(filterEligible([])).toEqual([]);
  });
});
