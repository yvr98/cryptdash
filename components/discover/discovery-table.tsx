import { getChainDef } from "@/lib/constants";
import type {
  DiscoveryPageModel,
  DiscoveryRow,
  FreshnessBucket,
} from "@/lib/page-data/discovery";
import type { KnownChainId } from "@/lib/types";

import Link from "next/link";
import { buildPoolPath } from "@/lib/constants/route";
type DiscoveryTableProps = {
  rows: DiscoveryPageModel["rows"];
  totalSupported: number;
  capped: boolean;
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

function chainName(chainId: KnownChainId): string {
  return getChainDef(chainId)?.name ?? String(chainId);
}

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

function FreshnessBadge({ freshness }: { freshness: FreshnessBucket }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${freshnessBadgeColor(freshness)}`}
    >
      {freshness}
    </span>
  );
}

function DiscoveryCard({ row }: { row: DiscoveryRow }) {
  const href = buildPoolPath(row.networkId, row.poolAddress);
  return (
    <Link href={href} className="block rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3 transition hover:bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[color:var(--foreground)]">
            {row.pairLabel}
          </span>
          <p className="mt-1 text-xs text-[color:var(--muted)]">{row.dexName}</p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <span
            className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold ${chainBadgeColor(row.chainId)}`}
          >
            {chainName(row.chainId as KnownChainId)}
          </span>
          <FreshnessBadge freshness={row.freshness} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--muted)]">
            Liquidity
          </p>
          <p className="text-xs font-semibold text-[color:var(--foreground)]">
            {formatUsd(row.liquidityUsd)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--muted)]">
            24h Vol
          </p>
          <p className="text-xs text-[color:var(--foreground)]">
            {formatUsd(row.volume24hUsd)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--muted)]">
            Txs
          </p>
          <p className="text-xs text-[color:var(--muted)]">
            {formatCount(row.transactions24h)}
          </p>
        </div>
      </div>
    </Link>
  );
}

export function DiscoveryTable({ rows, totalSupported, capped }: DiscoveryTableProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] sm:rounded-2xl">
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
          Discovery snapshot
        </p>
        <h2 className="mt-1 text-lg font-bold text-[color:var(--foreground)] sm:text-xl">
          Upstream-ranked pools across supported chains
        </h2>
        <p className="mt-2 text-xs text-[color:var(--muted)]">
          Showing {rows.length} supported pools{capped ? " from the current capped snapshot" : totalSupported > rows.length ? ` of ${totalSupported}` : ""}.
        </p>
      </div>

      <div className="mt-3 space-y-2 px-4 pb-4 sm:px-5 sm:pb-5 lg:hidden">
        {rows.map((row) => (
          <DiscoveryCard key={`${row.networkId}-${row.poolAddress}`} row={row} />
        ))}
      </div>

      <div className="mt-4 hidden lg:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead>
            <tr className="border-t border-[color:var(--border)]">
              <th className="w-[24%] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                Pair
              </th>
              <th className="w-[14%] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
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
              <th className="w-[10%] px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                Txs
              </th>
              <th className="w-[12%] px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                Freshness
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.networkId}-${row.poolAddress}`}
                className="border-t border-[color:var(--border)] transition hover:bg-white/[0.02]"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={buildPoolPath(row.networkId, row.poolAddress)}
                    className="truncate font-semibold text-[color:var(--foreground)] hover:underline"
                  >
                    {row.pairLabel}
                  </Link>
                </td>
                <td className="truncate px-4 py-2.5 text-[color:var(--muted)]">
                  {row.dexName}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${chainBadgeColor(row.chainId)}`}
                  >
                    {chainName(row.chainId as KnownChainId)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-[color:var(--foreground)]">
                  {formatUsd(row.liquidityUsd)}
                </td>
                <td className="px-4 py-2.5 text-right text-[color:var(--foreground)]">
                  {formatUsd(row.volume24hUsd)}
                </td>
                <td className="px-4 py-2.5 text-right text-[color:var(--muted)]">
                  {formatCount(row.transactions24h)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <FreshnessBadge freshness={row.freshness} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
