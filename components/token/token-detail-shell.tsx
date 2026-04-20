// =============================================================================
// TokenScope — Token Detail Shell
// =============================================================================
//
// Presentational shell for the /token/[coinId] page.
// Receives a server-built page model and renders a unified multi-chain view.
// =============================================================================

import Link from "next/link";

import { buildTokenPath } from "@/lib/constants";
import type { TokenDetailPageData } from "@/lib/page-data/token-detail";
import type { MarketData } from "@/lib/types";
import { selectDefaultChartMarket } from "@/lib/chart/select-market";
import { TokenChart } from "@/components/token/chart";
import { PoolsTable } from "@/components/token/pools-table";
import { RecommendationCard } from "@/components/token/recommendation-card";
import { WatchlistButton } from "@/components/token/watchlist-button";
import { WatchlistPanel } from "@/components/token/watchlist-panel";
import { ContractCopyButton } from "@/components/token/contract-copy-button";

type TokenDetailShellProps = {
  data: TokenDetailPageData;
};

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatPrice(price: number | null): string {
  if (price === null) return "—";
  if (price >= 1) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(price);
  }
  // Small prices: show more decimal places
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumSignificantDigits: 4,
  }).format(price);
}

function formatLargeNumber(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatSupply(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatPctChange(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function pctColor(pct: number | null): string {
  if (pct === null) return "text-[color:var(--muted)]";
  return pct >= 0 ? "text-[color:var(--up)]" : "text-[color:var(--down)]";
}

function previewAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TokenLogo({ token }: { token: TokenDetailPageData["token"] }) {
  const src = token.imageUrl ?? token.thumbUrl;
  if (src) {
    return (
      <img
        src={src}
        alt={token.name}
        width={48}
        height={48}
        className="h-12 w-12 rounded-full"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-lg font-bold text-[color:var(--accent)]">
      {token.symbol.toUpperCase().slice(0, 2)}
    </div>
  );
}

function MarketStats({ data }: { data: MarketData }) {
  const stats = [
    { label: "Market Cap", value: formatLargeNumber(data.marketCap) },
    { label: "24h Volume", value: formatLargeNumber(data.totalVolume24h) },
    { label: "FDV", value: formatLargeNumber(data.fullyDilutedValuation) },
    { label: "Circulating", value: formatSupply(data.circulatingSupply) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3"
        >
          <p className="text-[11px] font-medium uppercase tracking-wider text-[color:var(--muted)]">
            {s.label}
          </p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--foreground)]">
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function ChainBadge({ name, isAvailable }: { name: string; isAvailable: boolean }) {
  return (
    <span
      className={
        isAvailable
          ? "inline-flex items-center gap-1 rounded-full border border-[color:var(--up)] border-opacity-30 bg-[color:var(--up-soft)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--up)] sm:gap-1.5 sm:px-2.5 sm:text-[11px]"
          : "inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--muted)] sm:gap-1.5 sm:px-2.5 sm:text-[11px]"
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isAvailable ? "bg-[color:var(--up)]" : "bg-[color:var(--muted)] opacity-40"}`}
      />
      {name}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main shell
// ---------------------------------------------------------------------------

export function TokenDetailShell({ data }: TokenDetailShellProps) {
  const chartMarket = selectDefaultChartMarket(
    data.recommendation,
    data.eligiblePools
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8">
      <div className="grid w-full gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Main column */}
        <div className="space-y-4 sm:space-y-5">
          {/* Token Header */}
          <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:rounded-2xl sm:p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <TokenLogo token={data.token} />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-2xl">
                      {data.token.name}
                    </h1>
                    <span className="rounded-md bg-[color:var(--surface-strong)] px-2 py-0.5 text-xs font-medium uppercase text-[color:var(--muted)]">
                      {data.token.symbol.toUpperCase()}
                    </span>
                    {data.priceContext.marketCapRank && (
                      <span className="rounded-md bg-[color:var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[color:var(--accent)]">
                        #{data.priceContext.marketCapRank}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {data.supportedChains.map((chain) => (
                      <ChainBadge
                        key={chain.chainId}
                        name={chain.name}
                        isAvailable={chain.isAvailable}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <WatchlistButton
                coinId={data.token.coinId}
                name={data.token.name}
                symbol={data.token.symbol}
                thumbUrl={data.token.thumbUrl}
              />
            </div>

            {/* Price block */}
            <div className="mt-3 flex flex-wrap items-end gap-2 sm:mt-4 sm:gap-3">
              <span className="text-2xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-3xl">
                {formatPrice(data.marketData.currentPriceUsd)}
              </span>
              <span
                className={`text-lg font-semibold ${pctColor(data.marketData.priceChange24hPercent)}`}
              >
                {formatPctChange(data.marketData.priceChange24hPercent)}
              </span>
              <span className="text-xs text-[color:var(--muted)]">24h</span>
            </div>

            {/* Market stats grid */}
            <div className="mt-4">
              <MarketStats data={data.marketData} />
            </div>
          </section>

          {/* Upstream error banner */}
          {data.dataState.status === "upstream_error" && data.dataState.errors.length > 0 && (
            <section
              data-testid="upstream-error-banner"
              className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-amber-400">
                Data temporarily unavailable
              </p>
              <div className="mt-2 space-y-1">
                {data.dataState.errors.map((error) => (
                  <p key={`${error.source}-${error.category}`} className="text-sm text-[color:var(--muted)]">
                    {error.userMessage}
                  </p>
                ))}
              </div>
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                Showing available data. Try refreshing in a moment.
              </p>
            </section>
          )}

          {/* Recommendation */}
          <RecommendationCard recommendation={data.recommendation} dataState={data.dataState} />

          {/* Chart */}
          <TokenChart coinId={data.token.coinId} market={chartMarket} />

          {/* Pools Table */}
          <PoolsTable
            pools={data.eligiblePools}
            recommendedPoolAddress={data.recommendation.winner?.poolAddress}
            coinId={data.token.coinId}
          />

          {/* Contract information — collapsed by default */}
          {data.availableSupportedChains.length > 0 && (
            <details className="group rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]">
              <summary className="cursor-pointer select-none px-5 py-4 text-xs font-medium uppercase tracking-wider text-[color:var(--muted)] transition hover:text-[color:var(--foreground)]">
                Contract addresses ({data.availableSupportedChains.length} chains)
              </summary>
              <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
                {data.supportedChains
                  .filter((c) => c.isAvailable && c.contractAddress)
                  .map((chain) => (
                    <div
                      key={chain.chainId}
                      className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-[color:var(--foreground)]">
                          {chain.name}
                        </p>
                        <ChainBadge name="Mapped" isAvailable={true} />
                      </div>
                      <p className="mt-2 break-all font-mono text-xs text-[color:var(--muted)]">
                        {chain.contractAddress}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
                          {previewAddress(chain.contractAddress!)}
                        </p>
                        <ContractCopyButton address={chain.contractAddress!} />
                      </div>
                    </div>
                  ))}
              </div>
            </details>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 sm:space-y-5">
          {data.fallback && (
            <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-400">
                No supported chains
              </p>
              <h2 className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
                {data.fallback.title}
              </h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                {data.fallback.description}
              </p>
            </section>
          )}

          {/* External links */}
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
              Continue research
            </p>
            <ul className="mt-3 space-y-2">
              {data.externalLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                  >
                    <span>{link.label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
                      ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <WatchlistPanel />

          {/* Route badge */}
          <div className="flex justify-center">
            <Link
              href={buildTokenPath(data.token.coinId)}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              /token/{data.token.coinId}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
