// =============================================================================
// TokenScope — Pool Eligibility Filter
// =============================================================================
//
// Deterministic eligibility gating for the recommendation engine.
// Frozen thresholds from plan:
//   - liquidityUsd   >= 50,000
//   - volume24hUsd   >=  5,000
//   - transactions24h >=    20
//   - non-null DEX, pool address, pair label, and chain identifier
//
// PoolCandidate identity fields (poolAddress, dexName, pairLabel, chainId)
// are already guaranteed non-null by normalizePool at the adapter boundary,
// so this module only needs to enforce numeric thresholds.
// =============================================================================

import type { PoolCandidate } from "@/lib/types";

/** Minimum pool liquidity in USD to be eligible. */
export const MIN_LIQUIDITY_USD = 50_000;

/** Minimum 24-hour trading volume in USD to be eligible. */
export const MIN_VOLUME_24H_USD = 5_000;

/** Minimum 24-hour transaction count to be eligible. */
export const MIN_TRANSACTIONS_24H = 20;

/**
 * Check whether a single pool meets all v1 eligibility thresholds.
 * Null required metrics are treated as ineligible.
 */
export function isEligible(pool: PoolCandidate): boolean {
  if (pool.liquidityUsd === null) return false;
  if (pool.volume24hUsd === null) return false;
  if (pool.transactions24h === null) return false;

  if (pool.liquidityUsd < MIN_LIQUIDITY_USD) return false;
  if (pool.volume24hUsd < MIN_VOLUME_24H_USD) return false;
  if (pool.transactions24h < MIN_TRANSACTIONS_24H) return false;

  return true;
}

/**
 * Filter a list of pool candidates to only those passing v1 eligibility.
 * Deterministic and side-effect-free — safe for use in server components
 * and test fixtures alike.
 */
export function filterEligible(pools: PoolCandidate[]): PoolCandidate[] {
  return pools.filter(isEligible);
}
