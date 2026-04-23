// =============================================================================
// CryptDash — Pool Detail Page Data
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
import {
  capturePoolSnapshot,
  fetchPoolSnapshotHistory,
  isPoolSnapshotCaptureConfigured,
  type CapturePoolSnapshotInput,
  type CapturePoolSnapshotResult,
  type FetchPoolSnapshotHistoryInput,
} from "@/lib/api/rails-pool-snapshots";
import { SUPPORTED_CHAIN_LIST } from "@/lib/constants";
import { buildTokenPath } from "@/lib/constants/route";
import { classifyFreshness, type FreshnessBucket } from "@/lib/page-data/discovery";
import type { DataState, UpstreamErrorInfo } from "@/lib/page-data/token-detail";
import type { PoolRecord, PoolSnapshotHistory, PoolSnapshotRow } from "@/lib/types";
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
  /** Stable supplemental market history for later UI consumption. */
  history: PoolDetailHistory;
  /** Upstream health metadata — mirrors token-detail DataState conventions. */
  dataState: DataState;
}

export type PoolDetailHistoryState = "ready" | "sparse" | "unavailable";

export type PoolDetailHistoryCardState = "ready" | "sparse";

export interface PoolDetailHistoryPoint {
  timestamp: string;
  value: number;
}

export interface PoolDetailHistoryCard {
  label: "Liquidity" | "24h Vol" | "24h Txs";
  state: PoolDetailHistoryCardState;
  latestValue: number | null;
  delta: number | null;
  points: PoolDetailHistoryPoint[];
}

export interface PoolDetailHistory {
  state: PoolDetailHistoryState;
  cards: [PoolDetailHistoryCard, PoolDetailHistoryCard, PoolDetailHistoryCard];
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

export type PoolSnapshotCapturer = (
  input: CapturePoolSnapshotInput,
) => Promise<CapturePoolSnapshotResult>;

export type PoolSnapshotCaptureFailureLogger = (
  error: unknown,
  input: CapturePoolSnapshotInput,
) => void;

export type PoolSnapshotHistoryReader = (
  input: FetchPoolSnapshotHistoryInput,
) => Promise<PoolSnapshotHistory>;

export interface PoolDetailPageDataSideEffects {
  captureSnapshot?: PoolSnapshotCapturer;
  logCaptureFailure?: PoolSnapshotCaptureFailureLogger;
  readHistory?: PoolSnapshotHistoryReader;
}

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

function toCaptureInput(pool: PoolRecord): CapturePoolSnapshotInput {
  return {
    networkId: pool.networkId,
    poolAddress: pool.poolAddress,
    liquidityUsd: pool.liquidityUsd,
    volume24hUsd: pool.volume24hUsd,
    transactions24h: pool.transactions24h,
  };
}

function defaultLogCaptureFailure(
  error: unknown,
  input: CapturePoolSnapshotInput,
): void {
  console.error("Pool snapshot capture failed", {
    error,
    networkId: input.networkId,
    poolAddress: input.poolAddress,
  });
}

function triggerPoolSnapshotCapture(
  pool: PoolRecord,
  captureSnapshot: PoolSnapshotCapturer,
  logCaptureFailure: PoolSnapshotCaptureFailureLogger,
): void {
  const input = toCaptureInput(pool);

  void Promise.resolve()
    .then(() => captureSnapshot(input))
    .catch((error: unknown) => {
      logCaptureFailure(error, input);
    });
}

function shouldTriggerPoolSnapshotCapture(
  captureSnapshot: PoolSnapshotCapturer,
): boolean {
  if (captureSnapshot !== capturePoolSnapshot) {
    return true;
  }

  return isPoolSnapshotCaptureConfigured();
}

type HistoryMetricKey = keyof Pick<
  PoolSnapshotRow,
  "liquidityUsd" | "volume24hUsd" | "transactions24h"
>;

interface HistoryCardDefinition {
  label: PoolDetailHistoryCard["label"];
  metric: HistoryMetricKey;
}

const HISTORY_CARD_DEFINITIONS: readonly [
  HistoryCardDefinition,
  HistoryCardDefinition,
  HistoryCardDefinition,
] = [
  { label: "Liquidity", metric: "liquidityUsd" },
  { label: "24h Vol", metric: "volume24hUsd" },
  { label: "24h Txs", metric: "transactions24h" },
];

function isValidTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function buildEmptyHistoryCard(
  label: PoolDetailHistoryCard["label"],
): PoolDetailHistoryCard {
  return {
    label,
    state: "sparse",
    latestValue: null,
    delta: null,
    points: [],
  };
}

function buildUnavailableHistory(): PoolDetailHistory {
  return {
    state: "unavailable",
    cards: [
      buildEmptyHistoryCard("Liquidity"),
      buildEmptyHistoryCard("24h Vol"),
      buildEmptyHistoryCard("24h Txs"),
    ],
  };
}

function isUsableHistory(value: unknown): value is PoolSnapshotHistory {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  if (
    !isFiniteNumber(candidate.windowHours) ||
    !isFiniteNumber(candidate.rowCount) ||
    !Array.isArray(candidate.rows)
  ) {
    return false;
  }

  return candidate.rows.every((row) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      return false;
    }

    const candidateRow = row as Record<string, unknown>;

    return (
      "capturedAt" in candidateRow &&
      "liquidityUsd" in candidateRow &&
      "volume24hUsd" in candidateRow &&
      "transactions24h" in candidateRow
    );
  });
}

function buildHistoryCard(
  rows: PoolSnapshotRow[],
  definition: HistoryCardDefinition,
): PoolDetailHistoryCard {
  const points = rows.flatMap((row) => {
    const value = row[definition.metric];

    if (!isValidTimestamp(row.capturedAt) || !isFiniteNumber(value)) {
      return [];
    }

    return [{ timestamp: row.capturedAt, value }];
  });

  const oldest = points[0] ?? null;
  const latest = points[points.length - 1] ?? null;

  return {
    label: definition.label,
    state: points.length >= 3 ? "ready" : "sparse",
    latestValue: latest?.value ?? null,
    delta: oldest && latest ? latest.value - oldest.value : null,
    points,
  };
}

function shapeHistory(history: PoolSnapshotHistory): PoolDetailHistory {
  const cards = HISTORY_CARD_DEFINITIONS.map((definition) =>
    buildHistoryCard(history.rows, definition),
  ) as PoolDetailHistory["cards"];

  return {
    state: cards.some((card) => card.state === "ready") ? "ready" : "sparse",
    cards,
  };
}

async function readPoolHistory(
  network: string,
  poolAddress: string,
  readHistory: PoolSnapshotHistoryReader,
): Promise<PoolDetailHistory> {
  try {
    const history = await readHistory({
      networkId: network,
      poolAddress,
      hours: 24,
    });

    if (!isUsableHistory(history)) {
      return buildUnavailableHistory();
    }

    return shapeHistory(history);
  } catch {
    return buildUnavailableHistory();
  }
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
  sideEffects: PoolDetailPageDataSideEffects = {},
): Promise<PoolDetailPageData> {
  const upstreamErrors: UpstreamErrorInfo[] = [];
  let dataStatus: "complete" | "upstream_error" = "complete";
  let pool: PoolRecord;
  let history = buildUnavailableHistory();
  let hasLivePool = false;
  const captureSnapshot = sideEffects.captureSnapshot ?? capturePoolSnapshot;
  const logCaptureFailure =
    sideEffects.logCaptureFailure ?? defaultLogCaptureFailure;
  const readHistory = sideEffects.readHistory ?? fetchPoolSnapshotHistory;

  try {
    pool = await fetchPool(network, poolAddress);
    hasLivePool = true;

    if (shouldTriggerPoolSnapshotCapture(captureSnapshot)) {
      triggerPoolSnapshotCapture(pool, captureSnapshot, logCaptureFailure);
    }
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

  if (hasLivePool) {
    history = await readPoolHistory(network, poolAddress, readHistory);
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
    history,
    dataState: {
      status: dataStatus,
      errors: upstreamErrors,
    },
  };
}
