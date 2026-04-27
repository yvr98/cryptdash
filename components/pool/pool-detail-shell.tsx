import Link from "next/link";
import type { ReactNode } from "react";

import { HistoryMetricCard } from "@/components/pool/history-metric-card";
import { buildPoolPath, getChainDef } from "@/lib/constants";
import type { PoolDetailHistory, PoolDetailPageData } from "@/lib/page-data/pool-detail";
import type { FreshnessBucket } from "@/lib/page-data/discovery";

const MARKET_HISTORY_DEMO_PATH = buildPoolPath(
  "base",
  "0x6c561b446416e1a00e8e93e221854d6ea4171372",
  "ethereum"
);

type PoolDetailShellProps = {
  data: PoolDetailPageData;
  historySlot?: ReactNode;
};

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

function formatSignedAbsoluteDelta(
  value: number | null,
  formatter: (value: number | null) => string,
): string {
  if (value === null) return "—";

  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatter(Math.abs(value))}`;
}

function formatPriceChange(value: number | null): string {
  if (value === null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatTokenPrice(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 8 })}`;
}

function changeColor(value: number | null): string {
  if (value === null) return "text-[color:var(--muted)]";
  return value >= 0 ? "text-[color:var(--up)]" : "text-[color:var(--down)]";
}

function chainBadgeColor(chainId: number | null): string {
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

function freshnessBadgeColor(freshness: FreshnessBucket): string {
  switch (freshness) {
    case "New":
      return "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]";
    case "Recent":
      return "border-amber-500/30 bg-amber-500/10 text-amber-400";
    case "Established":
      return "border-[color:var(--border)] bg-[color:var(--background)] text-[color:var(--foreground)]";
    case "Unknown":
    default:
      return "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--muted)]";
  }
}

function resolveChainName(chainId: number | null, networkId: string): string {
  if (chainId !== null) {
    return getChainDef(chainId)?.name ?? networkId;
  }

  return networkId;
}

function FreshnessBadge({ freshness }: { freshness: FreshnessBucket }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${freshnessBadgeColor(freshness)}`}
    >
      {freshness}
    </span>
  );
}

function MetricCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--muted)]">
        {label}
      </p>
      <p className={`mt-2 text-lg font-semibold text-[color:var(--foreground)] ${valueClassName ?? ""}`.trim()}>
        {value}
      </p>
    </div>
  );
}

export function PoolHistoryLoadingSection() {
  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:rounded-2xl sm:p-5 md:p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
        Market history
      </p>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Preparing stored 24h history. This section will update automatically when ready.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {["Liquidity", "24h Vol", "24h Txs"].map((label) => (
          <div
            key={label}
            className="min-h-28 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-4"
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--muted)]">
              {label}
            </p>
            <div className="mt-3 h-4 w-24 rounded bg-[color:var(--surface)]" />
            <div className="mt-3 h-2 w-full rounded bg-[color:var(--surface)]" />
            <div className="mt-2 h-2 w-3/4 rounded bg-[color:var(--surface)]" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function PoolHistorySection({ history }: { history: PoolDetailHistory }) {
  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:rounded-2xl sm:p-5 md:p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
        Market history
      </p>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Last 24 hours of stored liquidity, volume, and transaction activity for this pool.
      </p>

      {history.state === "sparse" && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-[color:var(--muted)]">
            History is still building for this pool. Check back after more snapshots are collected.
          </p>
          <Link
            href={MARKET_HISTORY_DEMO_PATH}
            className="inline-flex text-sm font-medium text-[color:var(--accent)] transition hover:opacity-80"
          >
            See a fully-built market history example →
          </Link>
        </div>
      )}

      {history.state === "unavailable" && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-[color:var(--muted)]">
            Stored history is temporarily unavailable for this pool. Try refreshing in a moment.
          </p>
          <Link
            href={MARKET_HISTORY_DEMO_PATH}
            className="inline-flex text-sm font-medium text-[color:var(--accent)] transition hover:opacity-80"
          >
            See a fully-built market history example →
          </Link>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {history.cards.map((card) => {
          const valueFormatter = card.label === "24h Txs" ? formatCount : formatUsd;
          const value = valueFormatter(card.latestValue);
          const deltaText = formatSignedAbsoluteDelta(card.delta, valueFormatter);
          const deltaClassName = changeColor(card.delta);
          const isSectionUnavailable = history.state === "unavailable";

          return (
            <HistoryMetricCard
              key={card.label}
              card={card}
              value={value}
              deltaText={deltaText}
              deltaClassName={deltaClassName}
              isSectionUnavailable={isSectionUnavailable}
            />
          );
        })}
      </div>
    </section>
  );
}

export function PoolDetailShell({ data, historySlot }: PoolDetailShellProps) {
  const chainName = resolveChainName(data.pool.chainId, data.pool.networkId);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8">
      <div className="w-full space-y-4 sm:space-y-5">
        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:rounded-2xl sm:p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
                  Pool detail
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-3xl">
                    {data.pool.pairLabel || "Pool unavailable"}
                  </h1>
                  <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${chainBadgeColor(data.pool.chainId)}`}>
                    {chainName}
                  </span>
                  <FreshnessBadge freshness={data.freshness} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-[color:var(--muted)]">
                <span>{data.pool.dexName || "DEX unavailable"}</span>
                <span aria-hidden="true">•</span>
                <span>{data.pool.networkId}</span>
              </div>
            </div>

            {data.backlink ? (
              <Link
                href={data.backlink.tokenPath}
                className="inline-flex items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                ← Back to token
              </Link>
            ) : (
              <p className="max-w-sm text-sm text-[color:var(--muted)]">
                Opened directly from a pool link, so token page context is unavailable for this view.
              </p>
            )}
          </div>
        </section>

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

        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:rounded-2xl sm:p-5 md:p-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="DEX" value={data.pool.dexName || "—"} />
            <MetricCard label="Chain" value={chainName} />
            <MetricCard label="Network" value={data.pool.networkId || "—"} />
            <MetricCard label="Freshness" value={data.freshness} />
            <MetricCard label="Liquidity" value={formatUsd(data.pool.liquidityUsd)} />
            <MetricCard label="24h Vol" value={formatUsd(data.pool.volume24hUsd)} />
            <MetricCard label="24h Txs" value={formatCount(data.pool.transactions24h)} />
            <MetricCard
              label="24h Change"
              value={formatPriceChange(data.pool.priceChange24h)}
              valueClassName={changeColor(data.pool.priceChange24h)}
            />
          </div>
        </section>

        {historySlot ?? <PoolHistorySection history={data.history} />}

        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:rounded-2xl sm:p-5 md:p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
            Token prices
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MetricCard
              label="Base token"
              value={formatTokenPrice(data.pool.baseTokenPriceUsd)}
            />
            <MetricCard
              label="Quote token"
              value={formatTokenPrice(data.pool.quoteTokenPriceUsd)}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
