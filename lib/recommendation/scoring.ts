// =============================================================================
// TokenScope — Pool Scoring Engine
// =============================================================================
//
// Deterministic scoring of eligible pool candidates.
// Frozen weights from plan:
//   - liquidity:    60%
//   - 24h volume:   30%
//   - transactions: 10%
//
// Each metric is min-max normalised across the candidate set to [0, 1]
// before weighting. If all pools share the same value for a metric,
// that metric scores 1.0 for every pool (no differentiation).
// =============================================================================

import type { PoolCandidate, ScoredPoolCandidate } from "@/lib/types";

/** Frozen recommendation weights. */
export const WEIGHT_LIQUIDITY = 0.6;
export const WEIGHT_VOLUME = 0.3;
export const WEIGHT_TRANSACTIONS = 0.1;

/**
 * Min-max normalise an array of non-null numbers to [0, 1].
 * Returns 1.0 for all items when the range is zero (all equal).
 */
function normalise(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range === 0) return values.map(() => 1);
  return values.map((v) => (v - min) / range);
}

/**
 * Score a set of eligible pool candidates using the frozen weights.
 * Returns a new array of ScoredPoolCandidate sorted by score descending.
 * Each pool receives a composite score in [0, 1].
 *
 * Expects all pools to have non-null required metrics (guaranteed by
 * filterEligible). If any required metric is null it is treated as 0.
 */
export function scorePools(pools: PoolCandidate[]): ScoredPoolCandidate[] {
  if (pools.length === 0) return [];

  const liquidities = pools.map((p) => p.liquidityUsd ?? 0);
  const volumes = pools.map((p) => p.volume24hUsd ?? 0);
  const transactions = pools.map((p) => p.transactions24h ?? 0);

  const normLiq = normalise(liquidities);
  const normVol = normalise(volumes);
  const normTx = normalise(transactions);

  const scored = pools.map((pool, i) => {
    const score =
      normLiq[i] * WEIGHT_LIQUIDITY +
      normVol[i] * WEIGHT_VOLUME +
      normTx[i] * WEIGHT_TRANSACTIONS;

    return { ...pool, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}
