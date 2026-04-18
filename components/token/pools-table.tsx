"use client";

// =============================================================================
// TokenScope — Pools Table
// =============================================================================
//
// Data-dense pool comparison table with chain badges, green/red price
// changes, and recommended row highlighting.
//
// Desktop: full table with all columns visible — no horizontal scroll.
// Mobile: card-based layout for each pool for readability.
// =============================================================================

import { useEffect, useMemo, useState } from "react";

import type { PoolCandidate, KnownChainId } from "@/lib/types";
import { getChainDef } from "@/lib/constants";

type PoolsTableProps = {
  pools: PoolCandidate[];
  recommendedPoolAddress?: string;
};

const POOLS_PER_PAGE = 10;

function formatUsd(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatCount(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString();
}

function formatPriceChange(value: number | null): string {
  if (value === null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function chainName(chainId: KnownChainId): string {
  return getChainDef(chainId)?.name ?? String(chainId);
}

/** Color-code chain badges for quick visual scanning. */
function chainBadgeColor(chainId: number): string {
  switch (chainId) {
    case 1:
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    case 8453:
      return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    case 42161:
      return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    case 137:
      return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    case 56:
      return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    default:
      return "bg-[color:var(--surface)] text-[color:var(--muted)] border-[color:var(--border)]";
  }
}

function changeColor(value: number | null | undefined): string {
  if (value !== null && value !== undefined) {
    return value >= 0 ? "text-[color:var(--up)]" : "text-[color:var(--down)]";
  }
  return "text-[color:var(--muted)]";
}

// ---------------------------------------------------------------------------
// Mobile card for a single pool
// ---------------------------------------------------------------------------

function PoolCard({
  pool,
  isRecommended,
}: {
  pool: PoolCandidate;
  isRecommended: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        isRecommended
          ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
          : "border-[color:var(--border)] bg-[color:var(--background)]"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[color:var(--foreground)]">
            {pool.pairLabel}
          </span>
          {isRecommended && (
            <span className="rounded-md bg-[color:var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--accent)]">
              ★
            </span>
          )}
        </div>
        <span
          className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold ${chainBadgeColor(pool.chainId)}`}
        >
          {chainName(pool.chainId as KnownChainId)}
        </span>
      </div>

      {/* DEX name */}
      <p className="mt-1 text-xs text-[color:var(--muted)]">{pool.dexName}</p>

      {/* Stats grid */}
      <div className="mt-2 grid grid-cols-4 gap-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--muted)]">
            Liq
          </p>
          <p className="text-xs font-semibold text-[color:var(--foreground)]">
            {formatUsd(pool.liquidityUsd)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--muted)]">
            Vol
          </p>
          <p className="text-xs text-[color:var(--foreground)]">
            {formatUsd(pool.volume24hUsd)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--muted)]">
            Txs
          </p>
          <p className="text-xs text-[color:var(--muted)]">
            {formatCount(pool.transactions24h)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--muted)]">
            24h
          </p>
          <p className={`text-xs font-semibold ${changeColor(pool.priceChange24h)}`}>
            {formatPriceChange(pool.priceChange24h ?? null)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PoolsTable({ pools, recommendedPoolAddress }: PoolsTableProps) {
  const pageCount = Math.ceil(pools.length / POOLS_PER_PAGE);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [pools]);

  const visiblePools = useMemo(() => {
    const startIndex = (currentPage - 1) * POOLS_PER_PAGE;
    return pools.slice(startIndex, startIndex + POOLS_PER_PAGE);
  }, [currentPage, pools]);

  if (pools.length === 0) {
    return (
      <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:rounded-2xl sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
          Pool comparison
        </p>
        <h2 className="mt-2 text-xl font-bold text-[color:var(--foreground)]">
          No eligible pools
        </h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          No pools on supported chains meet the minimum liquidity, volume, and activity thresholds.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] sm:rounded-2xl">
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
          Pool comparison
        </p>
        <h2 className="mt-1 text-lg font-bold text-[color:var(--foreground)] sm:text-xl">
          Eligible pools across supported chains
        </h2>
        {pageCount > 1 && (
          <div className="mt-3 flex flex-col gap-3 border-t border-[color:var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[color:var(--muted)]">
              Showing {visiblePools.length} of {pools.length} pools · Page {currentPage} of {pageCount}
            </p>

            <nav aria-label="Pool comparison pagination" className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-1.5 text-xs font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[color:var(--border)] disabled:hover:text-[color:var(--foreground)]"
              >
                Previous
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {Array.from({ length: pageCount }, (_, index) => {
                  const pageNumber = index + 1;
                  const isActive = pageNumber === currentPage;

                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setCurrentPage(pageNumber)}
                      aria-current={isActive ? "page" : undefined}
                      className={`min-w-9 rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                        isActive
                          ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                          : "border-[color:var(--border)] bg-[color:var(--background)] text-[color:var(--foreground)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                disabled={currentPage === pageCount}
                className="rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-1.5 text-xs font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[color:var(--border)] disabled:hover:text-[color:var(--foreground)]"
              >
                Next
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* ---- Mobile card layout (below lg) ---- */}
      <div className="mt-3 space-y-2 px-4 pb-4 sm:px-5 sm:pb-5 lg:hidden">
        {visiblePools.map((pool) => {
          const isRecommended =
            recommendedPoolAddress !== undefined &&
            pool.poolAddress === recommendedPoolAddress;

          return (
            <PoolCard
              key={`${pool.chainId}-${pool.poolAddress}`}
              pool={pool}
              isRecommended={isRecommended}
            />
          );
        })}
      </div>

      {/* ---- Desktop table layout (lg and above) — fits container, no h-scroll ---- */}
      <div className="mt-4 hidden lg:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead>
            <tr className="border-t border-[color:var(--border)]">
              <th className="w-[18%] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                Pair
              </th>
              <th className="w-[16%] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                DEX
              </th>
              <th className="w-[12%] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                Chain
              </th>
              <th className="w-[14%] px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                Liquidity
              </th>
              <th className="w-[14%] px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                24h Vol
              </th>
              <th className="w-[12%] px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                Txs
              </th>
              <th className="w-[14%] px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                24h Δ
              </th>
            </tr>
          </thead>
          <tbody>
            {visiblePools.map((pool) => {
              const isRecommended =
                recommendedPoolAddress !== undefined &&
                pool.poolAddress === recommendedPoolAddress;

              const rowBase = isRecommended
                ? "border-t border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                : "border-t border-[color:var(--border)] transition hover:bg-white/[0.02]";

              return (
                <tr
                  key={`${pool.chainId}-${pool.poolAddress}`}
                  className={rowBase}
                >
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="truncate font-semibold text-[color:var(--foreground)]">
                        {pool.pairLabel}
                      </span>
                      {isRecommended && (
                        <span className="rounded-md bg-[color:var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--accent)]">
                          ★
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="truncate px-4 py-2.5 text-[color:var(--muted)]">
                    {pool.dexName}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${chainBadgeColor(pool.chainId)}`}
                    >
                      {chainName(pool.chainId as KnownChainId)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[color:var(--foreground)]">
                    {formatUsd(pool.liquidityUsd)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[color:var(--foreground)]">
                    {formatUsd(pool.volume24hUsd)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[color:var(--muted)]">
                    {formatCount(pool.transactions24h)}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${changeColor(pool.priceChange24h)}`}>
                    {formatPriceChange(pool.priceChange24h ?? null)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
