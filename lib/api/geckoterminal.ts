// =============================================================================
// TokenScope — Pool/OHLCV Upstream Adapter
// =============================================================================
//
// Server-side adapter for pool and OHLCV data.
// All numeric-string/null parsing happens at this boundary — downstream code
// only sees proper number | null types from @/lib/types.
//
// CoinGecko onchain returns pool and OHLCV data behind the standard API root.
// This adapter parses upstream string/number/null values exactly once.
// =============================================================================

import type { Candle, PoolCandidate, KnownChainId, TrendingPoolRow } from "@/lib/types";
import { SUPPORTED_CHAIN_LIST } from "@/lib/constants/chains";
import { UpstreamError, classifyHttpStatus } from "@/lib/api/upstream-error";

const COINGECKO_ONCHAIN_BASE = "https://api.coingecko.com/api/v3/onchain";
const JSON_ACCEPT = "application/json";

function buildHeaders(): HeadersInit {
  const apiKey = process.env.COINGECKO_API_KEY;

  return {
    Accept: JSON_ACCEPT,
    ...(apiKey ? { "x-cg-demo-api-key": apiKey } : {}),
  };
}

// ---------------------------------------------------------------------------
// Numeric parsing — the core of the adapter boundary
// ---------------------------------------------------------------------------

/**
 * Parse a nullable string/number value from upstream into number | null.
 * Returns null for null, undefined, empty string, or non-finite values.
 * This is the single point where upstream numeric strings become numbers.
 */
export function parseNum(
  val: string | number | null | undefined
): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/** Shape when transactions.h24 is an object with buys/sells. */
interface TxCountObject {
  buys?: string | number | null;
  sells?: string | number | null;
}

/**
 * Normalize transactions.h24 which may be a scalar (string/number/null)
 * or an object with buys/sells properties.
 * Derives total as buys + sells when present.
 */
function parseTxCount(
  val: string | number | TxCountObject | null | undefined
): number | null {
  if (val === null || val === undefined) return null;
  // Object shape: { buys, sells }
  if (typeof val === 'object') {
    const buys = parseNum((val as TxCountObject).buys);
    const sells = parseNum((val as TxCountObject).sells);
    if (buys !== null && sells !== null) return buys + sells;
    if (buys !== null) return buys;
    if (sells !== null) return sells;
    return null;
  }
  return parseNum(val);
}

// ---------------------------------------------------------------------------
// OHLCV — CoinGecko onchain ohlcv_list normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a raw upstream ohlcv_list into Candle[].
 *
 * Each row is [timestamp, open, high, low, close, volume?] where values
 * are strings, numbers, or nulls. Rows with null required OHLC fields are skipped.
 */
export function normalizeOhlcv(raw: (string | number | null)[][]): Candle[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const candles: Candle[] = [];

  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 5) continue;

    const time = parseNum(row[0]);
    const open = parseNum(row[1]);
    const high = parseNum(row[2]);
    const low = parseNum(row[3]);
    const close = parseNum(row[4]);

    // Skip rows missing required OHLC fields
    if (
      time === null ||
      open === null ||
      high === null ||
      low === null ||
      close === null
    ) {
      continue;
    }

    const candle: Candle = { time, open, high, low, close };

    if (row.length > 5) {
      const vol = parseNum(row[5]);
      if (vol !== null) candle.volume = vol;
    }

    candles.push(candle);
  }

  return candles;
}

/** Raw CoinGecko onchain OHLCV response shape. */
interface OhlcvResponse {
  data?: {
    attributes?: {
      ohlcv_list?: (string | number | null)[][];
    };
  };
}

/**
 * Fetch OHLCV candles for a pool from CoinGecko's standard-root onchain API.
 * All string parsing happens inside normalizeOhlcv.
 */
export async function fetchOhlcv(
  network: string,
  poolAddress: string,
  timeframe: string = "hour",
  limit: number = 168
): Promise<Candle[]> {
  const url = `${COINGECKO_ONCHAIN_BASE}/networks/${network}/pools/${encodeURIComponent(poolAddress)}/ohlcv/${timeframe}?limit=${limit}`;
  const res = await fetch(url, { headers: buildHeaders() });

  if (!res.ok) {
    throw new UpstreamError(classifyHttpStatus(res.status), res.status, "geckoterminal");
  }

  const data: OhlcvResponse = await res.json();
  const rawList = data?.data?.attributes?.ohlcv_list ?? [];

  return normalizeOhlcv(rawList);
}

// ---------------------------------------------------------------------------
// Pools — CoinGecko onchain pool attributes normalization
// ---------------------------------------------------------------------------

/** Raw pool attributes from CoinGecko onchain JSON:API response. */
interface RawPoolAttributes {
  address?: string;
  name?: string;
  /** @deprecated Live API no longer returns this; use relationships.dex.data.id */
  dex_id?: string;
  base_token_price_usd?: string | number | null;
  quote_token_price_usd?: string | number | null;
  reserve_in_usd?: string | number | null;
  volume_usd?: { h24?: string | number | null };
  /** @deprecated Use transactions.h24 for current API shape */
  transaction_count?: { h24?: string | number | null };
  transactions?: { h24?: string | number | TxCountObject | null };
  price_change_percentage?: { h24?: string | number | null };
}

/** Raw pool entry from CoinGecko onchain JSON:API response. */
interface RawPool {
  id?: string;
  type?: string;
  attributes?: RawPoolAttributes;
  relationships?: {
    network?: { data?: { id?: string } };
    dex?: { data?: { id?: string } };
  };
}

/** Raw CoinGecko onchain pools list response. */
interface PoolsResponse {
  data?: RawPool[];
}

/**
 * Normalize a single raw upstream pool into a PoolCandidate.
 * Returns null if the pool lacks required identity fields
 * (address, name, dex_id).
 *
 * All numeric-string/null fields are parsed via parseNum — downstream
 * code never sees the raw string values.
 */
export function normalizePool(
  raw: RawPool,
  chainId: KnownChainId
): PoolCandidate | null {
  const attrs = raw?.attributes;
  if (!attrs?.address || !attrs?.name) return null;

  const dexId =
    raw?.relationships?.dex?.data?.id || attrs.dex_id;
  if (!dexId) return null;

  return {
    poolAddress: attrs.address,
    chainId,
    dexName: dexId,
    pairLabel: attrs.name,
    baseTokenPriceUsd: parseNum(attrs.base_token_price_usd),
    quoteTokenPriceUsd: parseNum(attrs.quote_token_price_usd),
    liquidityUsd: parseNum(attrs.reserve_in_usd),
    volume24hUsd: parseNum(attrs.volume_usd?.h24),
    transactions24h: parseTxCount(attrs.transactions?.h24 ?? attrs.transaction_count?.h24),
    priceChange24h: parseNum(attrs.price_change_percentage?.h24),
  };
}

/**
 * Fetch pools for a token on a specific network from CoinGecko's standard-root onchain API.
 * Returns normalized PoolCandidate[] — all string parsing done at boundary.
 */
export async function fetchPoolsForToken(
  network: string,
  chainId: KnownChainId,
  contractAddress: string
): Promise<PoolCandidate[]> {
  const url = `${COINGECKO_ONCHAIN_BASE}/networks/${network}/tokens/${encodeURIComponent(contractAddress)}/pools`;
  const res = await fetch(url, { headers: buildHeaders() });

  if (!res.ok) {
    throw new UpstreamError(classifyHttpStatus(res.status), res.status, "geckoterminal");
  }

  const data: PoolsResponse = await res.json();
  const rawPools = data?.data ?? [];

  return rawPools
    .map((p) => normalizePool(p, chainId))
    .filter((p): p is PoolCandidate => p !== null);
}

// ---------------------------------------------------------------------------
// Discovery — GeckoTerminal public trending pools
// ---------------------------------------------------------------------------

const GECKOTERMINAL_BASE = "https://api.geckoterminal.com/api/v2";
const GT_ACCEPT = "application/json;version=20230203";

/**
 * Reverse lookup: GeckoTerminal network slug → KnownChainId.
 * Built from SUPPORTED_CHAIN_LIST at module load so the adapter stays
 * in sync with the canonical chain definitions.
 */
const networkToChainId = new Map<string, KnownChainId>(
  SUPPORTED_CHAIN_LIST.map((c) => [c.geckoTerminalNetwork, c.chainId])
);

/** Raw pool attributes from GeckoTerminal trending-pools response. */
interface RawTrendingPoolAttributes {
  address?: string;
  name?: string;
  reserve_in_usd?: string | number | null;
  volume_usd?: { h24?: string | number | null };
  transactions?: { h24?: string | number | TxCountObject | null };
  /** @deprecated Use transactions.h24 for current API shape */
  transaction_count?: { h24?: string | number | null };
  pool_created_at?: string | null;
}

/** Raw pool entry from GeckoTerminal trending-pools JSON:API response. */
interface RawTrendingPool {
  id?: string;
  type?: string;
  attributes?: RawTrendingPoolAttributes;
  relationships?: {
    network?: { data?: { id?: string } };
    dex?: { data?: { id?: string } };
  };
}

/** Raw GeckoTerminal trending-pools list response. */
interface TrendingPoolsResponse {
  data?: RawTrendingPool[];
}

/**
 * Normalize a single raw trending pool into a TrendingPoolRow.
 * Returns null if the pool lacks required identity fields
 * (address, name, dex id, network id).
 */
export function normalizeTrendingPool(
  raw: RawTrendingPool
): TrendingPoolRow | null {
  const attrs = raw?.attributes;
  if (!attrs?.address || !attrs?.name) return null;

  const networkId = raw?.relationships?.network?.data?.id;
  if (!networkId) return null;

  const dexId =
    raw?.relationships?.dex?.data?.id;
  if (!dexId) return null;

  const chainId = networkToChainId.get(networkId) ?? null;

  return {
    poolAddress: attrs.address,
    pairLabel: attrs.name,
    networkId,
    chainId,
    dexName: dexId,
    liquidityUsd: parseNum(attrs.reserve_in_usd),
    volume24hUsd: parseNum(attrs.volume_usd?.h24),
    transactions24h: parseTxCount(attrs.transactions?.h24 ?? attrs.transaction_count?.h24),
    poolCreatedAt: attrs.pool_created_at || null,
  };
}

/**
 * Fetch trending pools from GeckoTerminal's public API.
 * Returns normalized TrendingPoolRow[] in exact upstream order.
 */
export async function fetchTrendingPools(page: number = 1): Promise<TrendingPoolRow[]> {
  const params = new URLSearchParams({
    duration: "24h",
    page: String(page),
    include: "base_token,quote_token,dex,network",
    include_gt_community_data: "false",
  });

  const url = `${GECKOTERMINAL_BASE}/networks/trending_pools?${params}`;
  const res = await fetch(url, {
    headers: { Accept: GT_ACCEPT },
  });

  if (!res.ok) {
    throw new UpstreamError(classifyHttpStatus(res.status), res.status, "geckoterminal");
  }

  const data: TrendingPoolsResponse = await res.json();
  const rawPools = data?.data ?? [];

  return rawPools
    .map((p) => normalizeTrendingPool(p))
    .filter((p): p is TrendingPoolRow => p !== null);
}
