"use client";

// =============================================================================
// CryptDash — Watchlist Add/Remove Button
// =============================================================================

import { useState } from "react";

import { useAccount } from "@/components/account/account-provider";

type WatchlistButtonProps = {
  coinId: string;
  name: string;
  symbol: string;
  thumbUrl?: string;
};

export function WatchlistButton({
  coinId,
  name,
  symbol,
  thumbUrl,
}: WatchlistButtonProps) {
  const {
    addWatchlistItem,
    isWatched: hasWatched,
    removeWatchlistItem,
    status,
  } = useAccount();
  const [isPending, setIsPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const isWatched = hasWatched(coinId);

  async function handleToggle() {
    setFailed(false);
    setIsPending(true);

    try {
      if (isWatched) {
        await removeWatchlistItem(coinId);
      } else {
        await addWatchlistItem({ coinId, name, symbol, thumbUrl });
      }
    } catch {
      setFailed(true);
    } finally {
      setIsPending(false);
    }
  }

  if (status === "loading") {
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
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        data-testid="watchlist-button"
        aria-label={isWatched ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
        aria-pressed={isWatched}
        className={
          isWatched
            ? "inline-flex h-10 items-center justify-center rounded-2xl border border-[color:var(--accent)] bg-[color:var(--accent-soft)] px-3 text-sm font-semibold text-[color:var(--accent)] transition hover:border-[color:var(--danger)] hover:bg-[color:var(--danger)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
            : "inline-flex h-10 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
        }
      >
        <span className="sm:hidden">{isWatched ? "★ Saved" : "☆ Watch"}</span>
        <span className="hidden sm:inline">
          {isPending
            ? "Saving..."
            : isWatched
              ? "Remove from watchlist"
              : "Add to watchlist"}
        </span>
      </button>
      {failed && (
        <p className="text-right text-xs text-[color:var(--danger)]">
          Watchlist update failed.
        </p>
      )}
    </div>
  );
}
