"use client";

// =============================================================================
// CryptDash — Watchlist Panel
// =============================================================================

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { buildTokenPath } from "@/lib/constants";
import { getWatchlist, subscribeWatchlist } from "@/lib/watchlist";

function subscribeHydration() {
  return () => {};
}

/** Stable empty array for SSR snapshot — must be the same reference every render. */
const EMPTY_WATCHLIST: ReturnType<typeof getWatchlist> = [];

const getClientHydrated = () => true;
const getServerHydrated = () => false;
const getServerWatchlist = () => EMPTY_WATCHLIST;

export function WatchlistPanel() {
  const isHydrated = useSyncExternalStore(subscribeHydration, getClientHydrated, getServerHydrated);
  const entries = useSyncExternalStore(subscribeWatchlist, getWatchlist, getServerWatchlist);

  return (
    <section
      data-testid="watchlist-panel"
      className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5"
    >
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
            Watchlist
          </p>
          <h2 className="mt-1 text-lg font-bold text-[color:var(--foreground)]">
            Tracked tokens
          </h2>
        </div>

        {!isHydrated ? null : entries.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">
            No tokens tracked yet. Add tokens from their detail pages.
          </p>
        ) : (
          <ul className="space-y-2" aria-label="Watchlist entries">
            {entries.map((entry) => (
              <li key={entry.coinId}>
                <Link
                  href={buildTokenPath(entry.coinId)}
                  className="flex items-center justify-between rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2.5 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                >
                  <span className="flex items-center gap-2.5">
                    {entry.thumbUrl ? (
                      <Image
                        src={entry.thumbUrl}
                        alt=""
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[10px] font-bold text-[color:var(--accent)]">
                        {entry.symbol.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span>{entry.name}</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
                    {entry.symbol.toUpperCase()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
