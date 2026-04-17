// =============================================================================
// TokenScope — Recommendation Card
// =============================================================================
//
// Transparent, deterministic recommendation card. Shows status, confidence,
// rationale, close alternatives for near ties, disclaimer, and methodology.
// =============================================================================

import type { Recommendation } from "@/lib/types";
import { getChainDef } from "@/lib/constants";
import type { DataState } from "@/lib/page-data/token-detail";

type RecommendationCardProps = {
  recommendation: Recommendation;
  dataState?: DataState;
};

function confidenceLabel(confidence: string): string {
  switch (confidence) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return confidence;
  }
}

function confidenceBorder(confidence: string): string {
  switch (confidence) {
    case "high":
      return "border-emerald-500/30";
    case "medium":
      return "border-amber-500/30";
    case "low":
      return "border-[color:var(--border)]";
    default:
      return "border-[color:var(--border)]";
  }
}

function confidenceBadge(confidence: string): string {
  switch (confidence) {
    case "high":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    case "medium":
      return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "low":
      return "bg-[color:var(--surface)] text-[color:var(--muted)] border-[color:var(--border)]";
    default:
      return "bg-[color:var(--surface)] text-[color:var(--muted)] border-[color:var(--border)]";
  }
}

function chainName(chainId: number): string {
  return getChainDef(chainId)?.name ?? String(chainId);
}

function formatUsd(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function RecommendationCard({ recommendation, dataState }: RecommendationCardProps) {
  const { status, winner, runnerUp, confidence, rationale } = recommendation;
  const hasUpstreamError = dataState?.status === "upstream_error";
  const isDegraded = hasUpstreamError && (status === "insufficient_data" || status === "comparison_unavailable");

  return (
    <section className={`rounded-2xl border ${confidenceBorder(confidence)} bg-[color:var(--surface)]`}>
      <div className="p-5 sm:p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
              Pool suggestion
            </p>
            <span
              className={`rounded-full border px-3 py-0.5 text-[11px] font-semibold ${confidenceBadge(confidence)}`}
            >
              {confidenceLabel(confidence)}
            </span>
          </div>

          {/* Clear winner */}
          {status === "clear_winner" && winner && (
            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-[color:var(--foreground)]">
                Suggested best place to trade
              </h2>
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-bold text-[color:var(--foreground)]">
                    {winner.pairLabel}
                  </p>
                  <span className="rounded-md bg-[color:var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--accent)]">
                    {chainName(winner.chainId)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  {winner.dexName}
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <span className="text-[color:var(--muted)]">
                    Liquidity{" "}
                    <span className="font-semibold text-[color:var(--foreground)]">
                      {formatUsd(winner.liquidityUsd)}
                    </span>
                  </span>
                  <span className="text-[color:var(--muted)]">
                    24h Vol{" "}
                    <span className="font-semibold text-[color:var(--foreground)]">
                      {formatUsd(winner.volume24hUsd)}
                    </span>
                  </span>
                </div>
              </div>
              <p className="text-sm text-[color:var(--muted)]">{rationale}</p>
            </div>
          )}

          {/* Near tie */}
          {status === "near_tie" && winner && runnerUp && (
            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight text-[color:var(--foreground)]">
                Close alternatives
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[color:var(--accent)] border-opacity-30 bg-[color:var(--accent-soft)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--accent)]">
                    Slightly higher
                  </p>
                  <p className="mt-1 font-bold text-[color:var(--foreground)]">
                    {winner.pairLabel}
                  </p>
                  <p className="text-sm text-[color:var(--muted)]">
                    {winner.dexName} · {chainName(winner.chainId)}
                  </p>
                  <div className="mt-2 flex gap-3 text-xs text-[color:var(--muted)]">
                    <span>Liq {formatUsd(winner.liquidityUsd)}</span>
                    <span>Vol {formatUsd(winner.volume24hUsd)}</span>
                  </div>
                </div>
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                    Runner-up
                  </p>
                  <p className="mt-1 font-bold text-[color:var(--foreground)]">
                    {runnerUp.pairLabel}
                  </p>
                  <p className="text-sm text-[color:var(--muted)]">
                    {runnerUp.dexName} · {chainName(runnerUp.chainId)}
                  </p>
                  <div className="mt-2 flex gap-3 text-xs text-[color:var(--muted)]">
                    <span>Liq {formatUsd(runnerUp.liquidityUsd)}</span>
                    <span>Vol {formatUsd(runnerUp.volume24hUsd)}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-[color:var(--muted)]">{rationale}</p>
            </div>
          )}

          {/* Degraded: upstream error causing missing data */}
          {(status === "insufficient_data" || status === "comparison_unavailable") && isDegraded && (
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[color:var(--foreground)]">
                {status === "insufficient_data" ? "Pool data unavailable" : "Comparison unavailable"}
              </h2>
              <p className="text-sm text-[color:var(--muted)]">
                {status === "insufficient_data"
                  ? "Pool data couldn't be loaded. Try refreshing in a moment."
                  : rationale}
              </p>
            </div>
          )}

          {/* Normal: comparison unavailable */}
          {status === "comparison_unavailable" && !isDegraded && (
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[color:var(--foreground)]">
                Comparison unavailable
              </h2>
              <p className="text-sm text-[color:var(--muted)]">{rationale}</p>
            </div>
          )}

          {/* Normal: insufficient data */}
          {status === "insufficient_data" && !isDegraded && (
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[color:var(--foreground)]">
                Not enough data for a suggestion
              </h2>
              <p className="text-sm text-[color:var(--muted)]">{rationale}</p>
            </div>
          )}

          {/* Disclaimer */}
          <p className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-2.5 text-xs text-[color:var(--muted)]">
            Deterministic suggestion based on current metrics, not financial advice.
            Conditions change rapidly. Always verify before trading.
          </p>

          {/* How this works */}
          <details className="group rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]">
            <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-[color:var(--muted)] transition hover:text-[color:var(--accent)]">
              How this works
            </summary>
            <div className="space-y-2 px-4 pb-4 pt-1 text-sm text-[color:var(--muted)]">
              <p>Each eligible pool is scored with fixed weights:</p>
              <ul className="space-y-1 text-sm">
                <li>
                  <span className="font-semibold text-[color:var(--foreground)]">Liquidity 60%</span>
                  {" "}— price stability indicator
                </li>
                <li>
                  <span className="font-semibold text-[color:var(--foreground)]">24h Volume 30%</span>
                  {" "}— recent trading activity
                </li>
                <li>
                  <span className="font-semibold text-[color:var(--foreground)]">Transactions 10%</span>
                  {" "}— user activity breadth
                </li>
              </ul>
              <p>
                Pools need ≥$50K liquidity, ≥$5K volume, and ≥20 transactions to qualify.
                When the top two score within 5%, both are surfaced as close alternatives.
              </p>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
