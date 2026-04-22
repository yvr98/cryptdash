// =============================================================================
// TokenScope — Shared Type Definitions
// =============================================================================
//
// Canonical identity: CoinGecko coin ID.
// Route model: /token/[coinId]
// See lib/constants/route.ts for route model documentation.
// =============================================================================

// ---------------------------------------------------------------------------
// Chain Identity
// ---------------------------------------------------------------------------

/** Numeric chain IDs for all known/supported chains. */
export type KnownChainId = 1 | 8453 | 42161 | 137 | 56;

/** Supported chain IDs — all enabled chains in the current release. */
export type SupportedChainId = 1 | 8453 | 42161 | 137 | 56;

/**
 * @deprecated Use SupportedChainId instead. Kept for backward compatibility.
 */
export type RequiredV1ChainId = SupportedChainId;

/** Chain metadata consumed by adapters, UI, and recommendation engine. */
export interface ChainDef {
  /** EVM-numeric chain ID (e.g. 1 for Ethereum mainnet). */
  chainId: KnownChainId;
  /** Human-readable display name. */
  name: string;
  /** Short slug used in GeckoTerminal network paths (e.g. "eth", "base"). */
  geckoTerminalNetwork: string;
  /** CoinGecko asset-platform identifier (e.g. "ethereum", "base"). */
  coinGeckoPlatform: string;
  /** Whether this chain is enabled in the current release. */
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Market Data
// ---------------------------------------------------------------------------

/**
 * Market data for a token, fetched from CoinGecko.
 * All fields are nullable because upstream data may be unavailable.
 */
export interface MarketData {
  currentPriceUsd: number | null;
  priceChange24hPercent: number | null;
  marketCap: number | null;
  totalVolume24h: number | null;
  circulatingSupply: number | null;
  fullyDilutedValuation: number | null;
}

// ---------------------------------------------------------------------------
// Token & Search
// ---------------------------------------------------------------------------

/**
 * Canonical token representation.
 * Identified exclusively by CoinGecko coin ID — never by symbol alone.
 */
export interface Token {
  /** CoinGecko coin ID — the canonical identity anchor. */
  coinId: string;
  name: string;
  symbol: string;
  /** Optional thumbnail image URL from CoinGecko (25px). */
  thumbUrl?: string;
  /** Larger image URL from CoinGecko (64–200px). */
  imageUrl?: string;
  /** CoinGecko market-cap rank, if available. */
  marketCapRank?: number | null;
  /** Market data (price, 24h change, market cap, etc.). */
  marketData?: MarketData;
}

/**
 * A token's presence on a specific chain.
 * Maps the canonical CoinGecko identity to a per-chain contract address.
 */
export interface ChainToken {
  chainId: KnownChainId;
  /** CoinGecko coin ID linking back to the canonical token. */
  coinId: string;
  /** Contract address on this chain; undefined for native gas tokens. */
  contractAddress?: string;
  /** Token decimals, if known from upstream. */
  decimals?: number;
}

/**
 * A single search result returned from CoinGecko search.
 * The user must explicitly select a result before routing to /token/[coinId].
 */
export interface SearchResult {
  coinId: string;
  name: string;
  symbol: string;
  thumbUrl?: string;
  marketCapRank?: number | null;
  /** CoinGecko platforms map: { [coinGeckoPlatform]: contractAddress } */
  platforms?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Pools & Recommendation
// ---------------------------------------------------------------------------

/**
 * A DEX pool candidate eligible for the recommendation engine.
 * All numeric fields are parsed from upstream strings at the adapter boundary.
 */
export interface PoolCandidate {
  poolAddress: string;
  chainId: KnownChainId;
  dexName: string;
  /** Human-readable pair label (e.g. "WETH / USDC"). */
  pairLabel: string;
  /** Base token price in USD, if available. */
  baseTokenPriceUsd?: number | null;
  /** Quote token price in USD, if available. */
  quoteTokenPriceUsd?: number | null;
  /** Pool liquidity in USD. Required for eligibility. */
  liquidityUsd: number | null;
  /** 24-hour trading volume in USD. Required for eligibility. */
  volume24hUsd: number | null;
  /** 24-hour transaction count (buys + sells). Required for eligibility. */
  transactions24h: number | null;
  /** 24-hour price change percentage, if available. */
  priceChange24h?: number | null;
}

/**
 * A single trending pool row from GeckoTerminal's public trending-pools endpoint.
 * Lighter than PoolCandidate — carries enough for discovery display and
 * supported-chain filtering without recommendation scoring.
 * All numeric fields are parsed from upstream strings at the adapter boundary.
 */
export interface TrendingPoolRow {
  poolAddress: string;
  /** Human-readable pair label (e.g. "WETH / USDC"). */
  pairLabel: string;
  /** GeckoTerminal network identifier (e.g. "eth", "base"). */
  networkId: string;
  /** Numeric chain ID resolved from SUPPORTED_CHAINS, or null for unsupported chains. */
  chainId: KnownChainId | null;
  dexName: string;
  /** Pool liquidity in USD. */
  liquidityUsd: number | null;
  /** 24-hour trading volume in USD. */
  volume24hUsd: number | null;
  /** 24-hour transaction count (buys + sells). */
  transactions24h: number | null;
  /** ISO 8601 timestamp when the pool was created, or null. */
  poolCreatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Pool Detail
// ---------------------------------------------------------------------------

/**
 * A fully normalized pool record for pool detail views.
 * Carries canonical identity (networkId + poolAddress), all market signals,
 * and creation timestamp for freshness bucketing.
 *
 * chainId is null for pools on unsupported networks.
 */
export interface PoolRecord {
  /** On-chain pool address — unique within a GeckoTerminal network. */
  poolAddress: string;
  /** GeckoTerminal network identifier (e.g. "eth", "base"). */
  networkId: string;
  /** Numeric chain ID resolved from SUPPORTED_CHAINS, or null for unsupported. */
  chainId: KnownChainId | null;
  /** DEX name from GeckoTerminal. */
  dexName: string;
  /** Human-readable pair label (e.g. "WETH / USDC"). */
  pairLabel: string;
  /** Base token price in USD, if available. */
  baseTokenPriceUsd: number | null;
  /** Quote token price in USD, if available. */
  quoteTokenPriceUsd: number | null;
  /** Pool liquidity in USD. */
  liquidityUsd: number | null;
  /** 24-hour trading volume in USD. */
  volume24hUsd: number | null;
  /** 24-hour transaction count (buys + sells). */
  transactions24h: number | null;
  /** 24-hour price change percentage, if available. */
  priceChange24h: number | null;
  /** ISO 8601 pool creation timestamp, or null. */
  poolCreatedAt: string | null;
}

/** Confidence labels for the recommendation card. */
export type Confidence = "high" | "medium" | "low";

/** Recommendation status — determines what the card displays. */
export type RecommendationStatus =
  | "clear_winner"
  | "near_tie"
  | "comparison_unavailable"
  | "insufficient_data";

/**
 * Scored pool with its computed recommendation score.
 * Used internally by the recommendation engine.
 */
export interface ScoredPoolCandidate extends PoolCandidate {
  /** Normalised composite score (0–1). */
  score: number;
}

/**
 * Output of the deterministic recommendation engine.
 * The card is only shown when status is clear_winner or near_tie
 * and at least 2 eligible pools exist across supported chains.
 */
export interface Recommendation {
  status: RecommendationStatus;
  /** The top-scoring pool. Present for clear_winner and near_tie. */
  winner?: ScoredPoolCandidate;
  /** The runner-up pool. Present for near_tie (gap ≤ 5%). */
  runnerUp?: ScoredPoolCandidate;
  confidence: Confidence;
  /** All eligible pools in scored, descending recommendation order. */
  eligiblePools: ScoredPoolCandidate[];
  /** Human-readable rationale explaining the outcome. */
  rationale: string;
}

// ---------------------------------------------------------------------------
// Chart Data
// ---------------------------------------------------------------------------

/**
 * A single OHLCV candle for the chart.
 * GeckoTerminal ohlcv_list string arrays are parsed into this shape
 * at the adapter boundary.
 */
export interface Candle {
  /** Unix timestamp in seconds. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Optional volume for the candle period. */
  volume?: number;
}

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------

/**
 * A persisted watchlist entry stored in localStorage.
 * Uses canonical CoinGecko coin ID for identity.
 */
export interface WatchlistEntry {
  coinId: string;
  name: string;
  symbol: string;
  thumbUrl?: string;
  /** Unix timestamp (ms) when the entry was added. */
  addedAt: number;
}

// ---------------------------------------------------------------------------
// Rails Session Seam
// ---------------------------------------------------------------------------

/** Rails session capabilities reported by the backend. */
export interface RailsCapabilities {
  google_oauth: boolean;
  write_auth_enabled: boolean;
}

/** Rails user info when authenticated. */
export interface RailsUser {
  email: string;
}

/** Raw session payload returned by the Rails GET /api/v1/session endpoint. */
export interface RailsSessionPayload {
  authenticated: boolean;
  status: string;
  user: RailsUser | null;
  capabilities: RailsCapabilities;
}

/** Stable session response contract returned by the Rails session adapter. */
export interface SessionResponse {
  authenticated: boolean;
  status: string;
  user: RailsUser | null;
  capabilities: RailsCapabilities;
}

// ---------------------------------------------------------------------------
// Pool Snapshot History (Normalized Adapter Output)
// ---------------------------------------------------------------------------

/**
 * A single normalized pool snapshot row from the Rails history endpoint.
 * Raw Rails snake_case fields and string-encoded decimals are parsed into
 * this shape at the adapter boundary.
 */
export interface PoolSnapshotRow {
  /** ISO 8601 timestamp when the snapshot was captured. */
  capturedAt: string;
  /** Pool liquidity in USD, or null when the metric was absent. */
  liquidityUsd: number | null;
  /** 24-hour trading volume in USD, or null when the metric was absent. */
  volume24hUsd: number | null;
  /** 24-hour transaction count, or null when the metric was absent. */
  transactions24h: number | null;
}

/**
 * Normalized pool snapshot history envelope from the Rails public history endpoint.
 * Adapter output — raw Rails payload types remain adapter-local.
 * Rows are chronological (oldest-first).
 */
export interface PoolSnapshotHistory {
  /** The query window in hours. */
  windowHours: number;
  /** Number of snapshot rows in this response. */
  rowCount: number;
  /** Chronological snapshot rows (oldest-first). */
  rows: PoolSnapshotRow[];
}
