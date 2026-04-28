"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { AccountWatchlistItem, SessionResponse, WatchlistEntry } from "@/lib/types";
import {
  addToWatchlist,
  getWatchlist,
  isInWatchlist,
  removeFromWatchlist,
  subscribeWatchlist,
} from "@/lib/watchlist";

type AccountStatus = "loading" | "ready";
type WatchlistStatus = "idle" | "loading" | "ready" | "error";

type WatchlistInput = Omit<WatchlistEntry, "addedAt">;

type AccountContextValue = {
  session: SessionResponse | null;
  status: AccountStatus;
  watchlistStatus: WatchlistStatus;
  watchlistItems: WatchlistEntry[];
  isAuthenticated: boolean;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
  isWatched: (coinId: string) => boolean;
  addWatchlistItem: (item: WatchlistInput) => Promise<void>;
  removeWatchlistItem: (coinId: string) => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

const EMPTY_WATCHLIST: WatchlistEntry[] = [];
const FALLBACK_ACCOUNT_CONTEXT: AccountContextValue = {
  session: null,
  status: "ready",
  watchlistStatus: "idle",
  watchlistItems: EMPTY_WATCHLIST,
  isAuthenticated: false,
  refreshSession: async () => {},
  logout: async () => {},
  isWatched: isInWatchlist,
  addWatchlistItem: async (item) => {
    addToWatchlist(item);
  },
  removeWatchlistItem: async (coinId) => {
    removeFromWatchlist(coinId);
  },
};

function subscribeHydration() {
  return () => {};
}

function toWatchlistEntry(item: AccountWatchlistItem): WatchlistEntry {
  return {
    coinId: item.coinId,
    name: item.name,
    symbol: item.symbol,
    thumbUrl: item.thumbUrl ?? undefined,
    addedAt: Date.parse(item.addedAt),
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const isHydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const guestItems = useSyncExternalStore(
    subscribeWatchlist,
    getWatchlist,
    () => EMPTY_WATCHLIST
  );
  const [status, setStatus] = useState<AccountStatus>("loading");
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [accountItems, setAccountItems] = useState<WatchlistEntry[]>([]);
  const [watchlistStatus, setWatchlistStatus] = useState<WatchlistStatus>("idle");

  const isAuthenticated = Boolean(session?.authenticated);

  const refreshSession = useCallback(async () => {
    setStatus("loading");
    try {
      const nextSession = await fetchJson<SessionResponse>("/api/auth/session", {
        cache: "no-store",
      });
      setSession(nextSession);
    } catch {
      setSession(null);
    } finally {
      setStatus("ready");
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated) {
      setAccountItems([]);
      setWatchlistStatus("idle");
      return;
    }

    let isCancelled = false;
    setWatchlistStatus("loading");

    fetchJson<{ items: AccountWatchlistItem[] }>("/api/watchlist", {
      cache: "no-store",
    })
      .then((payload) => {
        if (!isCancelled) {
          setAccountItems(payload.items.map(toWatchlistEntry));
          setWatchlistStatus("ready");
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setAccountItems([]);
          setWatchlistStatus("error");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isHydrated, isAuthenticated]);

  const watchlistItems = isAuthenticated ? accountItems : guestItems;

  const value = useMemo<AccountContextValue>(() => {
    return {
      session,
      status,
      watchlistStatus,
      watchlistItems,
      isAuthenticated,
      refreshSession,
      async logout() {
        await fetchJson<{ status: string }>("/api/auth/logout", {
          method: "POST",
        });
        setSession(null);
        setAccountItems([]);
      },
      isWatched(coinId: string) {
        if (isAuthenticated) {
          return accountItems.some((entry) => entry.coinId === coinId);
        }

        return isInWatchlist(coinId);
      },
      async addWatchlistItem(item: WatchlistInput) {
        if (!isAuthenticated) {
          addToWatchlist(item);
          return;
        }

        const payload = await fetchJson<{ item: AccountWatchlistItem }>("/api/watchlist", {
          method: "POST",
          body: JSON.stringify(item),
        });
        const nextItem = toWatchlistEntry(payload.item);
        setAccountItems((current) => {
          if (current.some((entry) => entry.coinId === nextItem.coinId)) {
            return current;
          }
          return [nextItem, ...current];
        });
      },
      async removeWatchlistItem(coinId: string) {
        if (!isAuthenticated) {
          removeFromWatchlist(coinId);
          return;
        }

        await fetchJson<{ status: string }>(`/api/watchlist/${encodeURIComponent(coinId)}`, {
          method: "DELETE",
        });
        setAccountItems((current) => current.filter((entry) => entry.coinId !== coinId));
      },
    };
  }, [
    accountItems,
    isAuthenticated,
    refreshSession,
    session,
    status,
    watchlistItems,
    watchlistStatus,
  ]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const value = useContext(AccountContext);

  if (!value) {
    return FALLBACK_ACCOUNT_CONTEXT;
  }

  return value;
}
