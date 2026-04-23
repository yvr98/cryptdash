// =============================================================================
// CryptDash — Recommendation Engine Test
// =============================================================================
//
// Spec name (from plan): "returns clear winner for deterministic fixture"
//
// Scoring weights (frozen):
//   - liquidity: 60%
//   - 24h volume: 30%
//   - transactions: 10%
//
// Confidence rules:
//   - High: 3+ eligible pools, complete metrics, score gap > 10%
//   - Medium: 2+ eligible pools, score gap 5%-10%, or near_tie
//   - Low: comparison_unavailable or insufficient_data
//
// Near-tie rule: top score gap <= 5% shows close alternatives.
//
// Implementation lives in lib/recommendation/recommend.ts.
// Fixtures live in tests/fixtures/recommendation.ts.
// =============================================================================

import { describe, it, expect } from "vitest";

import { recommend } from "@/lib/recommendation/recommend";
import { scorePools } from "@/lib/recommendation/scoring";
import {
  clearWinnerPools,
  nearTiePools,
  insufficientDataPools,
  mixedEligibilityPools,
} from "@/tests/fixtures/recommendation";
import { filterEligible } from "@/lib/recommendation/eligibility";

// ---------------------------------------------------------------------------
// Clear winner
// ---------------------------------------------------------------------------

describe("returns clear winner for deterministic fixture", () => {
  it("picks the highest-scoring pool as winner from clearWinnerPools", () => {
    const result = recommend(clearWinnerPools);

    expect(result.status).toBe("clear_winner");
    expect(result.winner).toBeDefined();
    // The first fixture pool dominates liquidity (5M vs 200K vs 100K)
    expect(result.winner!.poolAddress).toBe("0x1111111111111111111111111111111111111111");
  });

  it("assigns high confidence when score gap > 10%", () => {
    const result = recommend(clearWinnerPools);

    expect(result.confidence).toBe("high");
  });

  it("includes rationale explaining why the winner was selected", () => {
    const result = recommend(clearWinnerPools);

    expect(result.rationale).toContain("WETH / USDC");
    expect(result.rationale).toContain("Uniswap V3");
    expect(result.rationale).toContain("Ethereum");
    expect(result.rationale).toContain("leads on the combined liquidity, volume, and activity score");
  });

  it("fixture: clearWinnerPools has a pool that clearly dominates liquidity", () => {
    const sorted = [...clearWinnerPools].sort(
      (a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0)
    );
    const top = sorted[0].liquidityUsd ?? 0;
    const runner = sorted[1].liquidityUsd ?? 0;
    const gap = (top - runner) / top;
    expect(gap).toBeGreaterThan(0.1);
  });

  it("fixture: clearWinnerPools has at least 3 eligible pools", () => {
    expect(clearWinnerPools.length).toBeGreaterThanOrEqual(3);
  });

  it("returns scored eligible pools in descending score order", () => {
    const result = recommend(clearWinnerPools);

    expect(result.eligiblePools.length).toBe(3);
    for (let i = 1; i < result.eligiblePools.length; i++) {
      expect(result.eligiblePools[i - 1]!.score).toBeGreaterThanOrEqual(
        result.eligiblePools[i]!.score
      );
    }
  });

  it("winner has the highest composite score", () => {
    const scored = scorePools(clearWinnerPools);
    const result = recommend(clearWinnerPools);

    expect(result.winner!.score).toBe(scored[0]!.score);
  });
});

// ---------------------------------------------------------------------------
// Near tie
// ---------------------------------------------------------------------------

describe("near tie recommendation surfaces close alternatives", () => {
  it("detects near tie when score gap <= 5%", () => {
    const result = recommend(nearTiePools);

    expect(result.status).toBe("near_tie");
  });

  it("includes runner-up in recommendation output", () => {
    const result = recommend(nearTiePools);

    expect(result.runnerUp).toBeDefined();
    expect(result.runnerUp!.poolAddress).toBe("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  });

  it("assigns medium confidence for near-tie scenarios", () => {
    const result = recommend(nearTiePools);

    expect(result.confidence).toBe("medium");
  });

  it("fixture: nearTiePools have similar liquidity levels", () => {
    const liqs = nearTiePools.map((p) => p.liquidityUsd ?? 0);
    const gap = Math.abs(liqs[0] - liqs[1]) / Math.max(liqs[0], liqs[1]);
    expect(gap).toBeLessThan(0.05);
  });

  it("near-tie rationale mentions close alternatives", () => {
    const result = recommend(nearTiePools);

    expect(result.rationale).toContain("narrow");
    expect(result.rationale).toContain("close alternatives worth considering");
  });
});

// ---------------------------------------------------------------------------
// Insufficient data
// ---------------------------------------------------------------------------

describe("insufficient data withholds recommendation", () => {
  it("returns status 'insufficient_data' when required metrics are null", () => {
    // insufficientDataPools all have null metrics → filterEligible returns []
    const eligible = filterEligible(insufficientDataPools);
    const result = recommend(eligible);

    expect(result.status).toBe("insufficient_data");
  });

  it("does not fabricate a recommendation from partial data", () => {
    const eligible = filterEligible(insufficientDataPools);
    const result = recommend(eligible);

    expect(result.winner).toBeUndefined();
    expect(result.runnerUp).toBeUndefined();
    expect(result.confidence).toBe("low");
  });

  it("fixture: insufficientDataPools have null required metrics", () => {
    const hasNull = insufficientDataPools.some(
      (p) => p.liquidityUsd === null || p.volume24hUsd === null || p.transactions24h === null
    );
    expect(hasNull).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Comparison unavailable (only 1 eligible pool)
// ---------------------------------------------------------------------------

describe("comparison unavailable when only one eligible pool exists", () => {
  it("returns 'comparison_unavailable' for a single eligible pool", () => {
    const singlePool = [clearWinnerPools[0]!];
    const result = recommend(singlePool);

    expect(result.status).toBe("comparison_unavailable");
    expect(result.confidence).toBe("low");
    expect(result.winner).toBeUndefined();
    expect(result.runnerUp).toBeUndefined();
  });

  it("rationale explains that comparison requires two pools", () => {
    const singlePool = [clearWinnerPools[0]!];
    const result = recommend(singlePool);

    expect(result.rationale).toContain("comparison requires at least two eligible pools");
  });
});

// ---------------------------------------------------------------------------
// Mixed eligibility
// ---------------------------------------------------------------------------

describe("mixed eligibility fixture produces valid recommendation", () => {
  it("filters to eligible pools and produces a recommendation", () => {
    const eligible = filterEligible(mixedEligibilityPools);
    const result = recommend(eligible);

    // mixedEligibilityPools = clearWinnerPools + ineligiblePools
    // After filtering, should have the 3 clear winner pools
    expect(eligible.length).toBe(3);
    expect(result.status).toBe("clear_winner");
    expect(result.winner).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Scoring determinism
// ---------------------------------------------------------------------------

describe("scoring is deterministic", () => {
  it("returns identical results for identical inputs", () => {
    const result1 = recommend(clearWinnerPools);
    const result2 = recommend(clearWinnerPools);

    expect(result1.status).toBe(result2.status);
    expect(result1.confidence).toBe(result2.confidence);
    expect(result1.winner?.poolAddress).toBe(result2.winner?.poolAddress);
    expect(result1.winner?.score).toBe(result2.winner?.score);
    expect(result1.rationale).toBe(result2.rationale);
  });
});
