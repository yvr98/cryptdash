"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useState } from "react";

import { SUPPORTED_CHAIN_LIST } from "@/lib/constants/chains";
import { buildTokenPath } from "@/lib/constants";
import type { SearchResult } from "@/lib/types";

const ETHEREUM_COIN_ID = "ethereum";
const ETHEREUM_PATH = buildTokenPath(ETHEREUM_COIN_ID);
const CONTRACT_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

type HeroSearchKeyEvent = Parameters<NonNullable<ComponentProps<"input">["onKeyDown"]>>[0];
type SearchMode = "text" | "contract";

type PlatformContext = {
  address: string;
  label: string;
  platformId: string;
};

const SUPPORTED_PLATFORM_LABELS = Object.freeze(
  Object.fromEntries(
    SUPPORTED_CHAIN_LIST.map((chain) => [chain.coinGeckoPlatform, chain.name])
  )
);

const PLATFORM_LABEL_OVERRIDES = Object.freeze({
  ...SUPPORTED_PLATFORM_LABELS,
  "optimistic-ethereum": "Optimism",
});

const SUPPORTED_CHAIN_NAMES = SUPPORTED_CHAIN_LIST.map((c) => c.name).join(" · ");

function isContractLikeQuery(query: string) {
  return CONTRACT_ADDRESS_PATTERN.test(query);
}

function previewContractAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatPlatformId(platformId: string) {
  return platformId
    .split(/[-_]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function getPlatformLabel(platformId: string) {
  return PLATFORM_LABEL_OVERRIDES[platformId as keyof typeof PLATFORM_LABEL_OVERRIDES] ?? formatPlatformId(platformId);
}

function getPlatformPriority(platformId: string) {
  const supportedIndex = SUPPORTED_CHAIN_LIST.findIndex(
    (chain) => chain.coinGeckoPlatform === platformId
  );

  if (supportedIndex >= 0) {
    return supportedIndex;
  }

  if (platformId in PLATFORM_LABEL_OVERRIDES) {
    return 50;
  }

  return 100;
}

function getPlatformContexts(result: SearchResult): PlatformContext[] {
  return Object.entries(result.platforms ?? {})
    .filter(([, address]) => Boolean(address))
    .map(([platformId, address]) => ({
      address,
      label: getPlatformLabel(platformId),
      platformId,
    }))
    .sort((left, right) => {
      const priorityDelta = getPlatformPriority(left.platformId) - getPlatformPriority(right.platformId);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return left.label.localeCompare(right.label);
    });
}

function getSupportedPlatformContexts(result: SearchResult) {
  const supportedPlatformIds = new Set(
    SUPPORTED_CHAIN_LIST.map((chain) => chain.coinGeckoPlatform)
  );

  return getPlatformContexts(result).filter((platform) =>
    supportedPlatformIds.has(platform.platformId)
  );
}

function hasSupportedPlatformContext(result: SearchResult) {
  return getSupportedPlatformContexts(result).length > 0;
}

function getExactContractMatches(result: SearchResult, query: string) {
  const normalizedQuery = query.toLowerCase();

  return getPlatformContexts(result).filter(
    (platform) => platform.address.toLowerCase() === normalizedQuery
  );
}

function filterResultsForQuery(results: SearchResult[], query: string, mode: SearchMode) {
  if (mode !== "contract") {
    return results;
  }

  return results.filter((result) => getExactContractMatches(result, query).length > 0);
}

function getContractPreview(result: SearchResult, submittedQuery: string, mode: SearchMode) {
  const exactMatch = mode === "contract" ? getExactContractMatches(result, submittedQuery)[0] : undefined;
  const firstPlatform = exactMatch ?? getPlatformContexts(result)[0];

  if (!firstPlatform) {
    return null;
  }

  return {
    label: firstPlatform.label,
    value: previewContractAddress(firstPlatform.address),
  };
}

export function HomeSearchHero() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function runSearch() {
    if (isLoading) return;

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setSubmittedQuery("");
      setSearchMode(null);
      setResults([]);
      setIsLoading(false);
      return;
    }

    const nextSearchMode: SearchMode = isContractLikeQuery(trimmedQuery) ? "contract" : "text";

    setSubmittedQuery(trimmedQuery);
    setSearchMode(nextSearchMode);
    setResults([]);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const searchResults = (await response.json()) as SearchResult[];
      setResults(filterResultsForQuery(searchResults, trimmedQuery, nextSearchMode));
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(event: HeroSearchKeyEvent) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void runSearch();
  }

  const hasSearchResults = results.length > 0;
  const showSearchPanel = Boolean(submittedQuery) || isLoading;

  return (
    <section className="relative flex flex-1 overflow-hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-1 items-center px-3 py-8 sm:px-6 md:py-12 lg:px-8 lg:py-20">
        <div className="w-full space-y-6 sm:space-y-8">
          {/* Hero header */}
          <div className="max-w-2xl space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-4xl md:text-5xl">
              Research a token.
              <span className="mt-1 block text-[color:var(--accent)]">
                Find where it&apos;s trading.
              </span>
            </h1>
            <p className="text-base text-[color:var(--muted)] sm:text-lg">
              Search any token, see real liquidity and volume data across {SUPPORTED_CHAIN_LIST.length} chains.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              {SUPPORTED_CHAIN_LIST.map((chain) => (
                <span
                  key={chain.chainId}
                  className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2.5 py-1 font-medium text-[color:var(--muted)]"
                >
                  {chain.name}
                </span>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="max-w-2xl">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <input
                  id="hero-search"
                  name="query"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search by name, symbol, or contract..."
                  autoComplete="off"
                  className="h-12 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm text-[color:var(--foreground)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-soft)]"
                  aria-describedby="hero-search-status"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    void runSearch();
                  }}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-xl bg-[color:var(--accent)] px-5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50 sm:flex-none"
                >
                  {isLoading ? "Searching…" : "Search"}
                </button>
                <Link
                  href={ETHEREUM_PATH}
                  className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border border-[color:var(--accent)] bg-[color:var(--accent-soft)] px-5 text-sm font-semibold text-[color:var(--accent)] transition hover:bg-[color:var(--accent)] hover:text-white sm:flex-none"
                >
                  Try ETH
                </Link>
              </div>
            </div>
          </div>

          {/* Results panel */}
          {showSearchPanel && (
            <div className="max-w-2xl rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
                    {isLoading
                      ? "Searching…"
                      : hasSearchResults
                        ? `${results.length} results for "${submittedQuery}"`
                        : `No results for "${submittedQuery}"`}
                  </p>
                </div>

                {!isLoading && hasSearchResults && (
                  <p className="text-xs text-[color:var(--muted)]">
                    Select the exact token to view its detail page.
                  </p>
                )}

                {hasSearchResults && (
                  <ul className="space-y-2" aria-label="Search results">
                    {results.map((result) => {
                      const platformContexts = getPlatformContexts(result);
                      const isSupported = hasSupportedPlatformContext(result);
                      const visiblePlatforms = platformContexts.slice(0, 4);
                      const remainingPlatforms = Math.max(platformContexts.length - visiblePlatforms.length, 0);
                      const contractPreview = getContractPreview(result, submittedQuery, searchMode ?? "text");

                      return (
                        <li key={result.coinId}>
                          <Link
                            href={buildTokenPath(result.coinId)}
                            className="group flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-3 transition hover:border-[color:var(--accent)]"
                          >
                            {/* Token logo */}
                            {result.thumbUrl ? (
                              <img
                                src={result.thumbUrl}
                                alt=""
                                width={32}
                                height={32}
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-xs font-bold text-[color:var(--accent)]">
                                {result.symbol.toUpperCase().slice(0, 2)}
                              </div>
                            )}

                            {/* Token info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-[color:var(--foreground)] group-hover:text-[color:var(--accent)]">
                                  {result.name}
                                </span>
                                <span className="text-xs text-[color:var(--muted)]">
                                  {result.symbol.toUpperCase()}
                                </span>
                                {result.marketCapRank && (
                                  <span className="rounded bg-[color:var(--surface)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--muted)]">
                                    #{result.marketCapRank}
                                  </span>
                                )}
                              </div>

                              <div className="mt-1 flex flex-wrap gap-1">
                                {visiblePlatforms.map((platform) => (
                                  <span
                                    key={`${result.coinId}-${platform.platformId}`}
                                    className="text-[10px] text-[color:var(--muted)]"
                                  >
                                    {platform.label}
                                  </span>
                                ))}
                                {remainingPlatforms > 0 && (
                                  <span className="text-[10px] text-[color:var(--muted)]">
                                    +{remainingPlatforms} more
                                  </span>
                                )}
                                {contractPreview && (
                                  <span className="font-mono text-[10px] text-[color:var(--muted)]">
                                    · {contractPreview.value}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Status badge */}
                            <span
                              className={
                                isSupported
                                  ? "shrink-0 rounded-md bg-[color:var(--up-soft)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--up)]"
                                  : "shrink-0 rounded-md bg-[color:var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--muted)]"
                              }
                            >
                              {isSupported ? "Supported" : "Limited"}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {!isLoading && !hasSearchResults && submittedQuery && (
                  <p className="text-sm text-[color:var(--muted)]">
                    {searchMode === "contract"
                      ? "No matching token found for this contract address."
                      : "No tokens matched. Try a different name or symbol."}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
