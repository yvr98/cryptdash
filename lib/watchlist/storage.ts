// =============================================================================
// CryptDash — Watchlist Storage (localStorage)
// =============================================================================
//
// Centralised localStorage abstraction for the watchlist.
// All raw localStorage access goes through this module — components never
// touch localStorage directly.
//
// Malformed state recovery: any parse error or unexpected shape is treated
// as an empty watchlist. The next successful mutation rewrites valid state.
// =============================================================================

import type { WatchlistEntry } from "@/lib/types";

const STORAGE_KEY = "cryptdash_watchlist";
const WATCHLIST_EVENT = "cryptdash:watchlist-updated";

// Module-level snapshot cache for referential stability.
// useSyncExternalStore requires getSnapshot to return the same reference
// when the underlying store has not changed. Without this cache,
// getWatchlist() creates a new array on every call (filter/[]),
// triggering React error 185 (Maximum update depth exceeded).
let cachedRaw: string | null = null;
let cachedParsed: WatchlistEntry[] = [];

/** Validate a single entry has the required string fields. */
function isValidEntry(entry: unknown): entry is WatchlistEntry {
  if (typeof entry !== "object" || entry === null) return false;
  const obj = entry as Record<string, unknown>;
  return (
    typeof obj.coinId === "string" &&
    obj.coinId.length > 0 &&
    typeof obj.name === "string" &&
    typeof obj.symbol === "string" &&
    typeof obj.addedAt === "number"
  );
}

/** Safely parse localStorage contents, returning [] for any corruption. */
function parseStored(raw: string | null): WatchlistEntry[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(isValidEntry);
    return valid;
  } catch {
    return [];
  }
}

/** Write entries to localStorage. Silently no-ops outside browser. */
function writeEntries(entries: WatchlistEntry[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new Event(WATCHLIST_EVENT));
  } catch {
    // Quota exceeded or private browsing — swallow gracefully.
  }
}

export function subscribeWatchlist(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleChange = () => onStoreChange();

  window.addEventListener("storage", handleChange);
  window.addEventListener(WATCHLIST_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(WATCHLIST_EVENT, handleChange);
  };
}

/** Read the full watchlist. Returns [] for missing or malformed state.
 * Referentially stable: returns the same array reference when localStorage
 * has not changed, which is required by useSyncExternalStore.
 */
export function getWatchlist(): WatchlistEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedParsed;
    const parsed = parseStored(raw);
    cachedRaw = raw;
    cachedParsed = parsed;
    return parsed;
  } catch {
    // If localStorage access fails (rare), still keep cache consistent.
    if (cachedRaw === null) return cachedParsed;
    cachedRaw = null;
    cachedParsed = [];
    return cachedParsed;
  }
}

/** Check whether a coin is already in the watchlist. */
export function isInWatchlist(coinId: string): boolean {
  return getWatchlist().some((entry) => entry.coinId === coinId);
}

/**
 * Add a token to the watchlist. Deduplicates by coinId.
 * If the coinId already exists, the existing entry is kept (no-op).
 * Returns the updated watchlist.
 */
export function addToWatchlist(
  entry: Omit<WatchlistEntry, "addedAt">
): WatchlistEntry[] {
  const current = getWatchlist();

  if (current.some((e) => e.coinId === entry.coinId)) {
    return current;
  }

  const next: WatchlistEntry = { ...entry, addedAt: Date.now() };
  const updated = [...current, next];
  writeEntries(updated);
  return updated;
}

/**
 * Remove a token from the watchlist by coinId.
 * Returns the updated watchlist.
 */
export function removeFromWatchlist(coinId: string): WatchlistEntry[] {
  const current = getWatchlist();
  const updated = current.filter((e) => e.coinId !== coinId);
  writeEntries(updated);
  return updated;
}
