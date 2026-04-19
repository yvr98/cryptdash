// =============================================================================
// TokenScope — Discovery Page Data Shaping
// =============================================================================
//
// Pure shaping logic for the discovery page model. Takes TrendingPoolRow[]
// pages from the GeckoTerminal adapter and produces a serializable page model
// with supported-chain filtering, deduplication, freshness buckets, and a
// 20-row cap.
//
// Upstream order is preserved exactly among retained rows — no sorting or
// reranking happens here.
// =============================================================================

import { isSupportedChain } from "@/lib/constants/chains";
import type { KnownChainId, TrendingPoolRow } from "@/lib/types";

// ---------------------------------------------------------------------------
// Freshness buckets
// ---------------------------------------------------------------------------

/** Deterministic freshness label derived from pool creation timestamp. */
export type FreshnessBucket = "New" | "Recent" | "Established" | "Unknown";

/** Millisecond thresholds for freshness bucketing. */
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const NEW_THRESHOLD_MS = MS_PER_DAY;         // < 24h
const RECENT_THRESHOLD_MS = 7 * MS_PER_DAY;  // < 7d

/**
 * Map an ISO 8601 pool creation timestamp to a deterministic freshness bucket.
 *
 * - `New`:         created less than 24 hours ago
 * - `Recent`:      created less than 7 days ago
 * - `Established`: created 7 or more days ago
 * - `Unknown`:     missing, empty, or unparseable timestamp
 *
 * Uses a supplied reference timestamp so tests stay deterministic.
 */
export function classifyFreshness(
  poolCreatedAt: string | null,
  referenceNow: number
): FreshnessBucket {
  if (!poolCreatedAt) return "Unknown";

  const created = Date.parse(poolCreatedAt);
  if (!Number.isFinite(created)) return "Unknown";

  const ageMs = referenceNow - created;
  if (ageMs < 0) return "Unknown";

  if (ageMs < NEW_THRESHOLD_MS) return "New";
  if (ageMs < RECENT_THRESHOLD_MS) return "Recent";
  return "Established";
}

// ---------------------------------------------------------------------------
// Discovery row — the shaped, serializable row model
// ---------------------------------------------------------------------------

export interface DiscoveryRow {
  /** GeckoTerminal network identifier (e.g. "eth", "base"). */
  networkId: string;
  /** GeckoTerminal pool address — on-chain identifier within the network. */
  poolAddress: string;
  /** Resolved supported chain ID. */
  chainId: KnownChainId;
  /** Human-readable pair label (e.g. "WETH / USDC"). */
  pairLabel: string;
  /** DEX name from GeckoTerminal. */
  dexName: string;
  /** Pool liquidity in USD. */
  liquidityUsd: number | null;
  /** 24-hour trading volume in USD. */
  volume24hUsd: number | null;
  /** 24-hour transaction count (buys + sells). */
  transactions24h: number | null;
  /** Deterministic freshness bucket. */
  freshness: FreshnessBucket;
  /** ISO 8601 pool creation timestamp (raw from upstream, for consumer use). */
  poolCreatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Empty-state metadata
// ---------------------------------------------------------------------------

/**
 * Serializable empty-state metadata for the discovery page model.
 * Present only when zero supported rows were retained after filtering.
 * Downstream components use this to render an honest empty-state
 * instead of fabricating content or silently showing nothing.
 */
export interface DiscoveryEmptyState {
  /** Machine-readable reason the result is empty. */
  reason: "no_supported_rows" | "no_input";
  /** Whether any upstream rows were provided but all were unsupported. */
  hadUnsupportedRows: boolean;
}

// ---------------------------------------------------------------------------
// Discovery page model
// ---------------------------------------------------------------------------

export interface DiscoveryPageModel {
  /** Supported, deduplicated rows in preserved upstream order, capped at 20. */
  rows: DiscoveryRow[];
  /** Total number of supported rows found across all scanned pages (before cap). */
  totalSupported: number;
  /** Number of upstream pages that were scanned (1–3). */
  pagesScanned: number;
  /** Whether rows hit the 20-row cap before exhausting input. */
  capped: boolean;
  /** Reference timestamp used for freshness bucketing. */
  referenceTime: number;
  /**
   * Explicit empty-state metadata when zero supported rows were retained.
   * Null when rows are present — downstream should check this field
   * instead of testing `rows.length` alone.
   */
  emptyState: DiscoveryEmptyState | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum supported rows to retain after filtering and deduplication. */
export const MAX_DISCOVERY_ROWS = 20;

/** Maximum number of upstream pages to scan sequentially. */
export const MAX_DISCOVERY_PAGES = 3;

// ---------------------------------------------------------------------------
// Shaping logic
// ---------------------------------------------------------------------------

/**
 * Build a dedupe key from network + pool address.
 * Both are lowercased for case-insensitive deduplication.
 */
function dedupeKey(networkId: string, poolAddress: string): string {
  return `${networkId.toLowerCase()}:${poolAddress.toLowerCase()}`;
}

/**
 * Convert a TrendingPoolRow into a shaped DiscoveryRow.
 * Returns null if the row's chain is not supported (chainId is null).
 */
function shapeRow(
  raw: TrendingPoolRow,
  referenceNow: number
): DiscoveryRow | null {
  if (raw.chainId === null) return null;
  if (!isSupportedChain(raw.chainId)) return null;

  return {
    networkId: raw.networkId,
    poolAddress: raw.poolAddress,
    chainId: raw.chainId,
    pairLabel: raw.pairLabel,
    dexName: raw.dexName,
    liquidityUsd: raw.liquidityUsd,
    volume24hUsd: raw.volume24hUsd,
    transactions24h: raw.transactions24h,
    freshness: classifyFreshness(raw.poolCreatedAt, referenceNow),
    poolCreatedAt: raw.poolCreatedAt,
  };
}

/**
 * Compute explicit empty-state metadata.
 * Returns null when rows are present; returns a stable DiscoveryEmptyState
 * when zero supported rows were retained.
 */
function computeEmptyState(
  totalSupported: number,
  hadPages: boolean,
  hadAnyRawRow: boolean
): DiscoveryEmptyState | null {
  if (totalSupported > 0) return null;

  if (!hadPages) {
    return { reason: "no_input", hadUnsupportedRows: false };
  }

  return {
    reason: "no_supported_rows",
    hadUnsupportedRows: hadAnyRawRow,
  };
}

/**
 * Shape discovery page data from TrendingPoolRow page arrays.
 *
 * Accepts up to 3 pages of TrendingPoolRow arrays (pages 1–3 from upstream),
 * scans them sequentially, and:
 * 1. Filters to supported chains only (chainId !== null)
 * 2. Deduplicates by {networkId}:{poolAddress}, keeping first occurrence
 * 3. Stops after collecting MAX_DISCOVERY_ROWS (20) supported unique rows
 * 4. Preserves upstream order among retained rows
 * 5. Maps poolCreatedAt into deterministic freshness buckets
 *
 * @param pages - Array of TrendingPoolRow[] arrays (one per upstream page)
 * @param referenceNow - Reference timestamp for freshness bucketing (default: Date.now())
 */
export function shapeDiscoveryRows(
  pages: TrendingPoolRow[][],
  referenceNow?: number
): DiscoveryPageModel {
  const now = referenceNow ?? Date.now();
  const seen = new Set<string>();
  const rows: DiscoveryRow[] = [];
  let totalSupported = 0;
  let pagesScanned = 0;
  let capped = false;
  let hadAnyRawRow = false;

  for (
    let pageIdx = 0;
    pageIdx < Math.min(pages.length, MAX_DISCOVERY_PAGES);
    pageIdx++
  ) {
    const page = pages[pageIdx];
    if (!page) continue;
    pagesScanned = pageIdx + 1;


    for (const raw of page) {
      hadAnyRawRow = true;
      const shaped = shapeRow(raw, now);
      if (shaped === null) continue;

      const key = dedupeKey(shaped.networkId, shaped.poolAddress);
      if (seen.has(key)) continue;

      seen.add(key);
      totalSupported++;

      if (rows.length < MAX_DISCOVERY_ROWS) {
        rows.push(shaped);
      }

      if (rows.length >= MAX_DISCOVERY_ROWS) {
        capped = true;
      }
    }

    if (capped) break;
  }

  return {
    rows,
    totalSupported,
    pagesScanned,
    capped,
    referenceTime: now,
    emptyState: computeEmptyState(totalSupported, pages.length > 0, hadAnyRawRow),
  };
}

// ---------------------------------------------------------------------------
// Async page-data assembly with upstream error handling
// ---------------------------------------------------------------------------

import { fetchTrendingPools } from "@/lib/api/geckoterminal";
import {
  isUpstreamError,
  type UpstreamErrorCategory,
} from "@/lib/api/upstream-error";
import type { DataState, UpstreamErrorInfo } from "@/lib/page-data/token-detail";

/** Serializable explanatory copy for the discovery page model. */
export interface DiscoveryExplanatoryCopy {
  /** Short heading for the current page state. */
  title: string;
  /** Longer description of the current page state. */
  description: string;
}

/** Serializable discovery page model including upstream error metadata and explanatory copy. */
export interface DiscoveryPageData extends DiscoveryPageModel {
  /** Upstream health metadata — "complete" when all fetches succeeded. */
  dataState: DataState;
  /** Stable explanatory copy for the current page state. */
  copy: DiscoveryExplanatoryCopy;
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
    category: "server_error" as UpstreamErrorCategory,
    source: "unknown",
    userMessage: "An unexpected error occurred while fetching discovery data.",
  };
}

function computeExplanatoryCopy(
  shaped: DiscoveryPageModel,
  dataStatus: "complete" | "upstream_error"
): DiscoveryExplanatoryCopy {
  if (dataStatus === "upstream_error" && shaped.rows.length > 0) {
    return {
      title: "Discovery data partially unavailable",
      description:
        "Some upstream discovery results could not be loaded. Showing available data only. Try refreshing in a moment.",
    };
  }

  if (dataStatus === "upstream_error") {
    return {
      title: "Discovery data unavailable",
      description:
        "The upstream discovery feed could not be loaded. No trending pool data is available right now. Try refreshing in a moment.",
    };
  }

  if (shaped.emptyState) {
    if (shaped.emptyState.reason === "no_input") {
      return {
        title: "No discovery snapshot available",
        description:
          "The upstream discovery feed did not return any rows for this snapshot yet. Try again in a moment.",
      };
    }
    if (shaped.emptyState.hadUnsupportedRows) {
      return {
        title: "No supported-chain pools in this snapshot",
        description:
          "Upstream discovery returned pools, but none mapped to TokenScope's supported chains.",
      };
    }
    return {
      title: "No pools in this snapshot",
      description:
        "Upstream discovery returned an empty snapshot, so there are no supported pools to show right now.",
    };
  }

  return {
    title: "Explore trending pools across supported chains",
    description:
      "Discovery order is upstream-ranked. TokenScope keeps the original feed order, filters it to supported chains, and shows the latest available liquidity, volume, activity, and freshness signals.",
  };
}

type TrendingPoolFetcher = (page: number) => Promise<TrendingPoolRow[]>;

/**
 * Build the complete page model for the discovery page.
 *
 * Fetches trending pools from GeckoTerminal pages 1–3 sequentially,
 * stopping once 20 supported rows are collected or pages are exhausted.
 * Upstream rate-limit/server failures are caught and surfaced as
 * renderable degraded states — the page never crashes.
 *
 * @param fetcher - Injected trending pool fetcher (defaults to fetchTrendingPools)
 * @param referenceNow - Reference timestamp for freshness bucketing (default: Date.now())
 */
export async function getDiscoveryPageData(
  fetcher: TrendingPoolFetcher = fetchTrendingPools,
  referenceNow?: number
): Promise<DiscoveryPageData> {
  const upstreamErrors: UpstreamErrorInfo[] = [];
  let dataStatus: "complete" | "upstream_error" = "complete";
  const pages: TrendingPoolRow[][] = [];

  for (let page = 1; page <= MAX_DISCOVERY_PAGES; page++) {
    try {
      const rows = await fetcher(page);
      pages.push(rows);

      // Check if we already have enough rows from shaping
      const partial = shapeDiscoveryRows(pages, referenceNow);
      if (partial.capped) break;
    } catch (err) {
      upstreamErrors.push(toErrorInfo(err));
      dataStatus = "upstream_error";

      // Stop fetching further pages after an upstream failure
      break;
    }
  }

  const shaped = shapeDiscoveryRows(pages, referenceNow);

  return {
    ...shaped,
    dataState: {
      status: dataStatus,
      errors: upstreamErrors,
    },
    copy: computeExplanatoryCopy(shaped, dataStatus),
  };
}
