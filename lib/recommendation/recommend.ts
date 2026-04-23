// =============================================================================
// CryptDash — Recommendation Engine
// =============================================================================
//
// Given a set of eligible pool candidates, produces a deterministic
// Recommendation with status, confidence, winner/runner-up, and rationale.
//
// Status rules (from plan):
//   - insufficient_data:      0 eligible pools
//   - comparison_unavailable:  1 eligible pool (cannot compare)
//   - near_tie:                2+ eligible pools, score gap <= 5%
//   - clear_winner:            2+ eligible pools, score gap > 5%
//
// Confidence rules (from plan):
//   - high:   3+ eligible pools, complete metrics, score gap > 10%
//   - medium: 2+ eligible pools, score gap 5-10%, or near_tie
//   - low:    comparison_unavailable or insufficient_data
// =============================================================================

import type {
  Confidence,
  PoolCandidate,
  Recommendation,
  RecommendationStatus,
  ScoredPoolCandidate,
} from "@/lib/types";
import { scorePools } from "@/lib/recommendation/scoring";
import { getChainDef } from "@/lib/constants";

/** Near-tie threshold: if score gap <= this value, it is a near tie. */
const NEAR_TIE_THRESHOLD = 0.05;

/** High-confidence threshold: score gap > this value means high confidence. */
const HIGH_CONFIDENCE_THRESHOLD = 0.10;

/**
 * Compute the score gap between winner and runner-up as a fraction
 * of the winner's score. Returns 0 when there is no runner-up or
 * the winner's score is zero.
 */
function scoreGap(winner: ScoredPoolCandidate, runnerUp?: ScoredPoolCandidate): number {
  if (!runnerUp || winner.score === 0) return 1;
  return (winner.score - runnerUp.score) / winner.score;
}

/**
 * Determine the recommendation status from eligible pool count and score gap.
 */
function determineStatus(
  eligibleCount: number,
  gap: number
): RecommendationStatus {
  if (eligibleCount === 0) return "insufficient_data";
  if (eligibleCount === 1) return "comparison_unavailable";
  if (gap <= NEAR_TIE_THRESHOLD) return "near_tie";
  return "clear_winner";
}

/**
 * Determine confidence label from status, eligible count, and score gap.
 */
function determineConfidence(
  status: RecommendationStatus,
  eligibleCount: number,
  gap: number
): Confidence {
  if (status === "insufficient_data") return "low";
  if (status === "comparison_unavailable") return "low";
  if (status === "near_tie") return "medium";
  // clear_winner
  if (eligibleCount >= 3 && gap > HIGH_CONFIDENCE_THRESHOLD) return "high";
  return "medium";
}

function chainLabel(chainId: number): string {
  return getChainDef(chainId)?.name ?? String(chainId);
}

function buildRationale(
  status: RecommendationStatus,
  winner?: ScoredPoolCandidate,
  runnerUp?: ScoredPoolCandidate,
  eligibleCount?: number
): string {
  switch (status) {
    case "insufficient_data":
      return "No eligible pools with sufficient data are available across supported chains. CryptDash withholds a suggestion until at least two pools meet the minimum liquidity, volume, and activity thresholds.";
    case "comparison_unavailable":
      return `Only ${eligibleCount} eligible pool was found across supported chains. A comparison requires at least two eligible pools to produce a meaningful suggestion.`;
    case "near_tie":
      return `${winner!.pairLabel} on ${winner!.dexName} (${chainLabel(winner!.chainId)}) scored slightly higher than ${runnerUp!.pairLabel} on ${runnerUp!.dexName} (${chainLabel(runnerUp!.chainId)}), but the gap is narrow. Both are close alternatives worth considering.`;
    case "clear_winner":
      return `${winner!.pairLabel} on ${winner!.dexName} (${chainLabel(winner!.chainId)}) leads on the combined liquidity, volume, and activity score across eligible pools.`;
  }
}

/**
 * Produce a deterministic Recommendation from a set of eligible pool candidates.
 *
 * This function is side-effect-free and deterministic: given the same input,
 * it always returns the same output. It does not access external APIs, time,
 * or random state.
 */
export function recommend(eligiblePools: PoolCandidate[]): Recommendation {
  const eligibleCount = eligiblePools.length;

  // 0 eligible → insufficient_data
  if (eligibleCount === 0) {
    return {
      status: "insufficient_data",
      confidence: "low",
      eligiblePools: [],
      rationale: buildRationale("insufficient_data"),
    };
  }

  const scored = scorePools(eligiblePools);
  const winner = scored[0];
  const runnerUp = scored.length >= 2 ? scored[1] : undefined;
  const gap = scoreGap(winner, runnerUp);

  const status = determineStatus(eligibleCount, gap);
  const confidence = determineConfidence(status, eligibleCount, gap);
  const rationale = buildRationale(status, winner, runnerUp, eligibleCount);

  return {
    status,
    winner: status === "clear_winner" || status === "near_tie" ? winner : undefined,
    runnerUp: status === "near_tie" ? runnerUp : undefined,
    confidence,
    eligiblePools: scored,
    rationale,
  };
}
