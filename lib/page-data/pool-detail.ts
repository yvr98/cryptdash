// =============================================================================
// TokenScope — Pool Detail Page Data
// =============================================================================
//
// Server-side page model for /pool/[network]/[poolAddress].
// Resolves a single normalized pool record, derives freshness using the shared
// discovery freshness function, exposes existing trust-adjacent signals only,
// preserves DataState / UpstreamErrorInfo degraded-state conventions, and
// surfaces backlink context only when coinId query context exists.
//
// Pool not-found propagates for route-level notFound().
// Upstream errors (429, 500, 503, timeouts) are caught and surfaced as stable
// degraded states — the page never crashes and never fabricates data.
// =============================================================================

import { isUpstreamError } from "@/lib/api/upstream-error";
import { fetchPoolRecord } from "@/lib/api/geckoterminal";
import { SUPPORTED_CHAIN_LIST } from "@/lib/constants";
import { buildTokenPath } from "@/lib/constants/route";
import { classifyFreshness, type FreshnessBucket } from "@/lib/page-data/discovery";
import type { DataState, UpstreamErrorInfo } from "@/lib/page-data/token-detail";
import type { PoolRecord } from "@/lib/types";
import type { KnownChainId } from "@/lib/types";

// ---------------------------------------------------------------------------
// Page data types
// ---------------------------------------------------------------------------

/** Navigation backlink to the parent token page. Only present when coinId context exists. */
export interface PoolDetailBacklink {
  /** CoinGecko coin ID — canonical token identity. */
  coinId: string;
  /** Absolute path back to the token detail page (e.g. "/token/ethereum"). */
  tokenPath: string;
}

/** Serializable pool detail page model for /pool/[network]/[poolAddress]. */
export interface PoolDetailPageData {
  /** The resolved pool record with identity and market signals. */
  pool: PoolRecord;
  /** Deterministic freshness bucket derived from poolCreatedAt. */
  freshness: FreshnessBucket;
  /** Backlink to parent token page; null for direct-entry without coinId context. */
  backlink: PoolDetailBacklink | null;
  /** Upstream health metadata — mirrors token-detail DataState conventions. */
  dataState: DataState;
}

// ---------------------------------------------------------------------------
// Dependency injection types
// ---------------------------------------------------------------------------

/**
 * Fetcher that resolves a single normalized pool record by network + address.
 * Must throw UpstreamError("not_found") when the pool does not exist.
 * Must throw UpstreamError for transient failures (429, 500, 503, timeout).
 */
export type PoolRecordFetcher = (
  network: string,
  poolAddress: string,
) => Promise<PoolRecord>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a GeckoTerminal network slug to a KnownChainId, or null. */
function resolveChainId(network: string): KnownChainId | null {
  const match = SUPPORTED_CHAIN_LIST.find(
    (c) => c.geckoTerminalNetwork === network,
  );
  return match ? (match.chainId as KnownChainId) : null;
}

function toErrorInfo(err: unknown): UpstreamErrorInfo {
  if (isUpstreamError(err)) {
    return {
      category: err.category,
      source: err.source,
      userMessage: err.message,
    };
  }
  return {
    category: "server_error",
    source: "unknown",
    userMessage:
      "An unexpected error occurred while fetching pool data.",
  };
}

/**
 * Build a stub PoolRecord for degraded-state rendering.
 * Uses local chain resolution (not upstream data) for chainId.
 */
function stubPool(
  network: string,
  poolAddress: string,
): PoolRecord {
  return {
    poolAddress,
    networkId: network,
    chainId: resolveChainId(network),
    dexName: "",
    pairLabel: "",
    baseTokenPriceUsd: null,
    quoteTokenPriceUsd: null,
    liquidityUsd: null,
    volume24hUsd: null,
    transactions24h: null,
    priceChange24h: null,
    poolCreatedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Main page data assembly
// ---------------------------------------------------------------------------

/**
 * Build the complete page model for /pool/[network]/[poolAddress].
 *
 * - Pool not found (UpstreamError "not_found") propagates for route-level notFound()
 * - Upstream errors (429, 500, 503) → degraded stub pool + upstream_error dataState
 * - Backlink is present only when coinId query context is provided
 * - Freshness is derived via the shared classifyFreshness() from discovery.ts
 *
 * @param network - GeckoTerminal network identifier (e.g. "eth", "base")
 * @param poolAddress - On-chain pool address
 * @param coinId - Optional CoinGecko coin ID for token backlink context
 * @param fetchPool - Injected pool fetcher (dependency injection for testing)
 * @param referenceNow - Reference timestamp for freshness bucketing (default: Date.now())
 */
export async function getPoolDetailPageData(
  network: string,
  poolAddress: string,
  coinId?: string,
  fetchPool: PoolRecordFetcher = fetchPoolRecord,
  referenceNow?: number,
): Promise<PoolDetailPageData> {
  const upstreamErrors: UpstreamErrorInfo[] = [];
  let dataStatus: "complete" | "upstream_error" = "complete";
  let pool: PoolRecord;

  try {
    pool = await fetchPool(network, poolAddress);
  } catch (err) {
    // not_found propagates for route-level notFound()
    if (isUpstreamError(err) && err.category === "not_found") {
      throw err;
    }

    // Other upstream errors: build a stub pool so the page renders
    // a degraded shell instead of crashing
    upstreamErrors.push(toErrorInfo(err));
    dataStatus = "upstream_error";
    pool = stubPool(network, poolAddress);
  }

  const now = referenceNow ?? Date.now();
  const freshness = classifyFreshness(pool.poolCreatedAt, now);

  // Backlink only when explicit coinId context exists
  const backlink: PoolDetailBacklink | null = coinId
    ? { coinId, tokenPath: buildTokenPath(coinId) }
    : null;

  return {
    pool,
    freshness,
    backlink,
    dataState: {
      status: dataStatus,
      errors: upstreamErrors,
    },
  };
}

