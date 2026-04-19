"use client";

// =============================================================================
// TokenScope — Navbar
// =============================================================================
//
// Persistent top navigation bar visible on every page.
// Logo links home, compact search with inline dropdown results.
// =============================================================================

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { buildTokenPath } from "@/lib/constants";
import type { SearchResult } from "@/lib/types";

const CONTRACT_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

function isContractLikeQuery(query: string) {
  return CONTRACT_ADDRESS_PATTERN.test(query);
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isHome = pathname === "/";
  const discoverLinkClassName =
    "inline-flex h-9 items-center rounded-lg border border-[color:var(--border)] px-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]";

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setMobileSearchOpen(false);
  }, [pathname]);

  function handleInputChange(value: string) {
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void searchTokens(trimmed);
    }, 300);
  }

  async function searchTokens(searchQuery: string) {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (!response.ok) throw new Error("Search failed");

      const data = (await response.json()) as SearchResult[];

      // If contract search, filter for exact matches
      if (isContractLikeQuery(searchQuery)) {
        const normalizedQuery = searchQuery.toLowerCase();
        const filtered = data.filter((result) =>
          Object.values(result.platforms ?? {}).some(
            (address) => address?.toLowerCase() === normalizedQuery
          )
        );
        setResults(filtered.slice(0, 6));
      } else {
        setResults(data.slice(0, 6));
      }
      setIsOpen(true);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelect(coinId: string) {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setMobileSearchOpen(false);
    router.push(buildTokenPath(coinId));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      const trimmed = query.trim();
      if (trimmed) {
        void searchTokens(trimmed);
      }
    }
    if (event.key === "Escape") {
      setIsOpen(false);
      setMobileSearchOpen(false);
    }
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-[color:var(--border)] bg-[color:var(--background)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-4 lg:px-8">
        {/* Logo / Home */}
        <Link
          href="/"
          className="group flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--accent)] text-sm font-black text-white">
            T
          </div>
          <span className="hidden text-base font-bold tracking-tight text-[color:var(--foreground)] sm:inline">
            TokenScope
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/discover" className={discoverLinkClassName}>
            Discover
          </Link>

          {/* Desktop search bar — hidden on home page and on very small screens */}
          {!isHome && (
            <div className="relative hidden sm:block" ref={dropdownRef}>
              <div className="relative">
                {/* Search icon */}
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    if (results.length > 0) setIsOpen(true);
                  }}
                  placeholder="Search tokens..."
                  autoComplete="off"
                  className="h-9 w-56 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] pl-9 pr-3 text-sm text-[color:var(--foreground)] outline-none transition-all placeholder:text-[color:var(--muted)] focus:w-72 focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent-soft)] lg:w-64 lg:focus:w-80"
                />
              </div>

              {/* Dropdown results */}
              {isOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-80 overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] shadow-lg shadow-black/30">
                  {isLoading ? (
                    <div className="px-4 py-3 text-sm text-[color:var(--muted)]">
                      Searching…
                    </div>
                  ) : results.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-[color:var(--muted)]">
                      No results found
                    </div>
                  ) : (
                    <ul>
                      {results.map((result) => (
                        <li key={result.coinId}>
                          <button
                            type="button"
                            onClick={() => handleSelect(result.coinId)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.04]"
                          >
                            {result.thumbUrl ? (
                              <img
                                src={result.thumbUrl}
                                alt=""
                                width={24}
                                height={24}
                                className="h-6 w-6 rounded-full"
                              />
                            ) : (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[10px] font-bold text-[color:var(--accent)]">
                                {result.symbol.toUpperCase().slice(0, 2)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                                  {result.name}
                                </span>
                                <span className="shrink-0 text-xs text-[color:var(--muted)]">
                                  {result.symbol.toUpperCase()}
                                </span>
                                {result.marketCapRank && (
                                  <span className="shrink-0 rounded bg-[color:var(--surface)] px-1 py-0.5 text-[10px] text-[color:var(--muted)]">
                                    #{result.marketCapRank}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mobile search toggle — hidden on home page */}
          {!isHome && (
            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen(!mobileSearchOpen);
                // Focus input after opening
                setTimeout(() => {
                  const mobileInput = document.getElementById(
                    "navbar-mobile-search"
                  );
                  mobileInput?.focus();
                }, 100);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[color:var(--border)] text-[color:var(--muted)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] sm:hidden"
              aria-label="Toggle search"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Mobile search expanded panel */}
      {!isHome && mobileSearchOpen && (
        <div className="border-t border-[color:var(--border)] px-3 pb-3 pt-2 sm:hidden">
          <div className="relative" ref={dropdownRef}>
            <input
              id="navbar-mobile-search"
              type="search"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search tokens..."
              autoComplete="off"
              className="h-10 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent-soft)]"
            />

            {/* Mobile dropdown results */}
            {isOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] shadow-lg shadow-black/30">
                {isLoading ? (
                  <div className="px-4 py-3 text-sm text-[color:var(--muted)]">
                    Searching…
                  </div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-[color:var(--muted)]">
                    No results found
                  </div>
                ) : (
                  <ul>
                    {results.map((result) => (
                      <li key={result.coinId}>
                        <button
                          type="button"
                          onClick={() => handleSelect(result.coinId)}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.04]"
                        >
                          {result.thumbUrl ? (
                            <img
                              src={result.thumbUrl}
                              alt=""
                              width={24}
                              height={24}
                              className="h-6 w-6 rounded-full"
                            />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[10px] font-bold text-[color:var(--accent)]">
                              {result.symbol.toUpperCase().slice(0, 2)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                                {result.name}
                              </span>
                              <span className="shrink-0 text-xs text-[color:var(--muted)]">
                                {result.symbol.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
