// =============================================================================
// CryptDash — Pool Candidate Fixtures
// =============================================================================
//
// Deterministic fixture data for recommendation engine tests.
// Covers: clear winner, near tie, insufficient data, ineligible pools.
//
// These fixtures represent PoolCandidate[] arrays that the recommendation
// engine (Task 9) will consume. Each export is a named scenario.
// =============================================================================

import type { PoolCandidate } from "@/lib/types";

// ---------------------------------------------------------------------------
// Clear Winner: one pool dominates on liquidity and volume
// ---------------------------------------------------------------------------

export const clearWinnerPools: PoolCandidate[] = [
  {
    poolAddress: "0x1111111111111111111111111111111111111111",
    chainId: 1,
    dexName: "Uniswap V3",
    pairLabel: "WETH / USDC",
    baseTokenPriceUsd: 3500,
    quoteTokenPriceUsd: 1,
    liquidityUsd: 5_000_000,
    volume24hUsd: 500_000,
    transactions24h: 1200,
    priceChange24h: 2.5,
  },
  {
    poolAddress: "0x2222222222222222222222222222222222222222",
    chainId: 8453,
    dexName: "Aerodrome",
    pairLabel: "WETH / USDC",
    baseTokenPriceUsd: 3500,
    quoteTokenPriceUsd: 1,
    liquidityUsd: 200_000,
    volume24hUsd: 50_000,
    transactions24h: 150,
    priceChange24h: 2.4,
  },
  {
    poolAddress: "0x3333333333333333333333333333333333333333",
    chainId: 1,
    dexName: "SushiSwap",
    pairLabel: "WETH / DAI",
    baseTokenPriceUsd: 3500,
    quoteTokenPriceUsd: 1,
    liquidityUsd: 100_000,
    volume24hUsd: 20_000,
    transactions24h: 80,
    priceChange24h: 2.3,
  },
];

// ---------------------------------------------------------------------------
// Near Tie: top two pools are within 5% score gap
// ---------------------------------------------------------------------------

export const nearTiePools: PoolCandidate[] = [
  {
    poolAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    chainId: 1,
    dexName: "Uniswap V3",
    pairLabel: "WETH / USDC",
    baseTokenPriceUsd: 3500,
    quoteTokenPriceUsd: 1,
    liquidityUsd: 1_000_000,
    volume24hUsd: 200_000,
    transactions24h: 500,
    priceChange24h: 1.1,
  },
  {
    poolAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    chainId: 8453,
    dexName: "Aerodrome",
    pairLabel: "WETH / USDC",
    baseTokenPriceUsd: 3500,
    quoteTokenPriceUsd: 1,
    liquidityUsd: 980_000,
    volume24hUsd: 210_000,
    transactions24h: 480,
    priceChange24h: 1.2,
  },
  // Third pool widens the normalization range so the top two compress into a near tie
  {
    poolAddress: "0x9999999999999999999999999999999999999999",
    chainId: 1,
    dexName: "SushiSwap",
    pairLabel: "WETH / DAI",
    baseTokenPriceUsd: 3500,
    quoteTokenPriceUsd: 1,
    liquidityUsd: 500_000,
    volume24hUsd: 100_000,
    transactions24h: 250,
    priceChange24h: 0.8,
  },
];

// ---------------------------------------------------------------------------
// Insufficient Data: pools with null required metrics
// ---------------------------------------------------------------------------

export const insufficientDataPools: PoolCandidate[] = [
  {
    poolAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
    chainId: 1,
    dexName: "Uniswap V3",
    pairLabel: "WETH / USDC",
    baseTokenPriceUsd: 3500,
    quoteTokenPriceUsd: 1,
    liquidityUsd: null,
    volume24hUsd: null,
    transactions24h: null,
  },
  {
    poolAddress: "0xdddddddddddddddddddddddddddddddddddddddd",
    chainId: 8453,
    dexName: "Aerodrome",
    pairLabel: "WETH / USDC",
    baseTokenPriceUsd: 3500,
    quoteTokenPriceUsd: 1,
    liquidityUsd: null,
    volume24hUsd: 100_000,
    transactions24h: 200,
  },
];

// ---------------------------------------------------------------------------
// Ineligible: pools that fail v1 eligibility thresholds
// (liquidity < 50k, volume < 5k, transactions < 20)
// ---------------------------------------------------------------------------

export const ineligiblePools: PoolCandidate[] = [
  {
    poolAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    chainId: 1,
    dexName: "TinyDEX",
    pairLabel: "SCAM / USDC",
    baseTokenPriceUsd: 0.001,
    quoteTokenPriceUsd: 1,
    liquidityUsd: 100,
    volume24hUsd: 10,
    transactions24h: 2,
    priceChange24h: 0,
  },
  {
    poolAddress: "0xffffffffffffffffffffffffffffffffffffffff",
    chainId: 8453,
    dexName: "SmallSwap",
    pairLabel: "WETH / USDC",
    baseTokenPriceUsd: 3500,
    quoteTokenPriceUsd: 1,
    liquidityUsd: 30_000,
    volume24hUsd: 2_000,
    transactions24h: 15,
    priceChange24h: 0.5,
  },
];

// ---------------------------------------------------------------------------
// Mixed: mix of eligible and ineligible pools
// ---------------------------------------------------------------------------

export const mixedEligibilityPools: PoolCandidate[] = [
  ...clearWinnerPools,
  ...ineligiblePools,
];
