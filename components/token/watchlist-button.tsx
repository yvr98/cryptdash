"use client";

// =============================================================================
// CryptDash — Watchlist Add/Remove Button
// =============================================================================
//
// Client component rendered inside the server-side token detail shell.
// Manages its own hydrated state to avoid SSR/client mismatch, and reads
// localStorage only after mount.
// =============================================================================

import { useSyncExternalStore } from "react";

import {
  addToWatchlist,
  isInWatchlist,
  removeFromWatchlist,
  subscribeWatchlist,
} from "@/lib/watchlist";

type WatchlistButtonProps = {
  coinId: string;
  name: string;
  symbol: string;
  thumbUrl?: string;
};

function subscribeHydration() {
  return () => {};
}

export function WatchlistButton({
  coinId,
  name,
  symbol,
  thumbUrl,
}: WatchlistButtonProps) {
  const isHydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const isWatched = useSyncExternalStore(
    subscribeWatchlist,
    () => isInWatchlist(coinId),
    () => false
  );

  function handleToggle() {
    if (isWatched) {
      removeFromWatchlist(coinId);
    } else {
      addToWatchlist({ coinId, name, symbol, thumbUrl });
    }
  }

  if (!isHydrated) {
    return (
      <button
        type="button"
        disabled
        data-testid="watchlist-button"
        className="inline-flex h-10 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 text-sm font-medium text-[color:var(--muted)] opacity-50"
      >
        Loading…
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      data-testid="watchlist-button"
      aria-label={isWatched ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
      aria-pressed={isWatched}
      className={
        isWatched
          ? "inline-flex h-10 items-center justify-center rounded-2xl border border-[color:var(--accent)] bg-[color:var(--accent-soft)] px-3 text-sm font-semibold text-[color:var(--accent)] transition hover:border-[color:var(--danger)] hover:bg-[color:var(--danger)] hover:text-white sm:px-4"
          : "inline-flex h-10 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] sm:px-4"
      }
    >
      <span className="sm:hidden">{isWatched ? "★ Saved" : "☆ Watch"}</span>
      <span className="hidden sm:inline">{isWatched ? "Remove from watchlist" : "Add to watchlist"}</span>
    </button>
  );
}
