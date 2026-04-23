// =============================================================================
// CryptDash — Recommendation Card Component Test
// =============================================================================
//
// Deterministic component tests for the RecommendationCard covering all
// four status states: clear_winner, near_tie, comparison_unavailable,
// insufficient_data.
// =============================================================================

import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { RecommendationCard } from "@/components/token/recommendation-card";
import { recommend } from "@/lib/recommendation/recommend";
import {
  clearWinnerPools,
  nearTiePools,
  insufficientDataPools,
} from "@/tests/fixtures/recommendation";
import { filterEligible } from "@/lib/recommendation/eligibility";

afterEach(cleanup);

// Pre-compute recommendations from fixtures for deterministic results
const clearWinnerRec = recommend(clearWinnerPools);
const nearTieRec = recommend(nearTiePools);
const insufficientRec = recommend(filterEligible(insufficientDataPools));
const comparisonUnavailableRec = recommend([clearWinnerPools[0]!]);

describe("RecommendationCard — clear_winner", () => {
  it("renders the suggestion heading", () => {
    render(<RecommendationCard recommendation={clearWinnerRec} />);
    expect(
      screen.getByText("Suggested best place to trade")
    ).toBeInTheDocument();
  });

  it("renders the winner pool pair label", () => {
    render(<RecommendationCard recommendation={clearWinnerRec} />);
    expect(screen.getAllByText("WETH / USDC").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the winner DEX name", () => {
    render(<RecommendationCard recommendation={clearWinnerRec} />);
    expect(screen.getByText("Uniswap V3")).toBeInTheDocument();
  });

  it("renders the winner chain as a badge", () => {
    render(<RecommendationCard recommendation={clearWinnerRec} />);
    expect(screen.getByText("Ethereum")).toBeInTheDocument();
  });

  it("renders high confidence badge", () => {
    render(<RecommendationCard recommendation={clearWinnerRec} />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("renders rationale text", () => {
    render(<RecommendationCard recommendation={clearWinnerRec} />);
    expect(
      screen.getByText(/leads on the combined liquidity, volume, and activity score/)
    ).toBeInTheDocument();
  });
});

describe("RecommendationCard — near_tie", () => {
  it("renders close alternatives heading", () => {
    render(<RecommendationCard recommendation={nearTieRec} />);
    expect(
      screen.getByText("Close alternatives")
    ).toBeInTheDocument();
  });

  it("renders both pools in the near-tie comparison", () => {
    render(<RecommendationCard recommendation={nearTieRec} />);
    expect(screen.getByText("Slightly higher")).toBeInTheDocument();
    expect(screen.getByText("Runner-up")).toBeInTheDocument();
  });

  it("renders medium confidence badge", () => {
    render(<RecommendationCard recommendation={nearTieRec} />);
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it("renders the runner-up pool information", () => {
    render(<RecommendationCard recommendation={nearTieRec} />);
    // Runner-up should show Aerodrome and Base
    expect(screen.getAllByText(/Aerodrome/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders rationale mentioning alternatives", () => {
    render(<RecommendationCard recommendation={nearTieRec} />);
    expect(
      screen.getByText(/close alternatives worth considering/)
    ).toBeInTheDocument();
  });
});

describe("RecommendationCard — comparison_unavailable", () => {
  it("renders comparison unavailable heading", () => {
    render(<RecommendationCard recommendation={comparisonUnavailableRec} />);
    expect(screen.getByText("Comparison unavailable")).toBeInTheDocument();
  });

  it("renders low confidence badge", () => {
    render(<RecommendationCard recommendation={comparisonUnavailableRec} />);
    expect(screen.getByText("Low")).toBeInTheDocument();
  });

  it("renders rationale explaining single pool limitation", () => {
    render(<RecommendationCard recommendation={comparisonUnavailableRec} />);
    expect(
      screen.getByText(/comparison requires at least two eligible pools/)
    ).toBeInTheDocument();
  });
});

describe("RecommendationCard — insufficient_data", () => {
  it("renders insufficient data heading", () => {
    render(<RecommendationCard recommendation={insufficientRec} />);
    expect(
      screen.getByText("Not enough data for a suggestion")
    ).toBeInTheDocument();
  });

  it("renders rationale explaining withheld suggestion", () => {
    render(<RecommendationCard recommendation={insufficientRec} />);
    expect(
      screen.getByText(/withholds a suggestion until at least two pools/)
    ).toBeInTheDocument();
  });
});

describe("RecommendationCard — common elements", () => {
  it("always renders the disclaimer", () => {
    render(<RecommendationCard recommendation={clearWinnerRec} />);
    expect(
      screen.getByText(/not financial advice/)
    ).toBeInTheDocument();
  });

  it("always renders the How this works disclosure", () => {
    render(<RecommendationCard recommendation={clearWinnerRec} />);
    expect(screen.getByText("How this works")).toBeInTheDocument();
  });

  it("disclosure contains the frozen weights when opened", () => {
    render(<RecommendationCard recommendation={clearWinnerRec} />);
    expect(screen.getByText(/Liquidity 60%/)).toBeInTheDocument();
    expect(screen.getByText(/24h Volume 30%/)).toBeInTheDocument();
    expect(screen.getByText(/Transactions 10%/)).toBeInTheDocument();
  });

  it("disclosure mentions eligibility thresholds", () => {
    render(<RecommendationCard recommendation={clearWinnerRec} />);
    expect(screen.getByText(/\$50K/)).toBeInTheDocument();
    expect(screen.getByText(/\$5K/)).toBeInTheDocument();
    expect(screen.getByText(/20/)).toBeInTheDocument();
  });

  it("disclosure mentions the 5% near-tie threshold", () => {
    render(<RecommendationCard recommendation={clearWinnerRec} />);
    expect(screen.getByText(/within 5%/)).toBeInTheDocument();
  });
});
