// =============================================================================
// CryptDash — CoinGecko Upstream Adapter
// =============================================================================
//
// Server-side adapter for CoinGecko search and token metadata.
// All numeric/null parsing happens at this boundary.
// API key consumed from process.env — never exposed client-side.
// =============================================================================

import {
  buildMarketCacheKey,
  getMarketCacheFreshTtlSeconds,
  isFreshMarketCacheEntry,
  isRedisMarketCacheEnabled,
  readMarketCacheEntry,
  writeMarketCacheEntry,
  type MarketCacheEntry,
} from "@/lib/api/market-cache";
import type { SearchResult, Token, MarketData } from "@/lib/types";
import { UpstreamError, classifyHttpStatus } from "@/lib/api/upstream-error";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

function buildHeaders(): HeadersInit {
  const h: HeadersInit = { Accept: "application/json" };
  const key = process.env.COINGECKO_API_KEY;
  if (key) {
    h["x-cg-demo-api-key"] = key;
  }
  return h;
}

function normalizePlatforms(
  platforms: Record<string, string> | undefined
): Record<string, string> {
  if (!platforms) return {};

  const normalized: Record<string, string> = {};

  for (const [platformId, address] of Object.entries(platforms)) {
    const normalizedPlatformId = platformId.trim();
    const normalizedAddress = address.trim();

    if (!normalizedPlatformId || !normalizedAddress) {
      continue;
    }

    normalized[normalizedPlatformId] = normalizedAddress;
  }

  return normalized;
}

/** Parse a nullable numeric value from upstream. */
function parseNum(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Raw upstream shapes (what CoinGecko actually returns)
// ---------------------------------------------------------------------------

interface RawSearchCoin {
  id: string;
  name: string;
  symbol: string;
  thumb?: string;
  market_cap_rank?: number | null;
  platforms?: Record<string, string>;
}

interface RawSearchResponse {
  coins: RawSearchCoin[];
}

interface RawMarketData {
  current_price?: Record<string, number | null>;
  price_change_percentage_24h?: number | null;
  market_cap?: Record<string, number | null>;
  total_volume?: Record<string, number | null>;
  circulating_supply?: number | null;
  fully_diluted_valuation?: Record<string, number | null>;
}

interface RawCoinDetail {
  id: string;
  symbol: string;
  name: string;
  image?: { thumb?: string; small?: string; large?: string };
  market_cap_rank?: number | null;
  platforms?: Record<string, string>;
  market_data?: RawMarketData;
}

// ---------------------------------------------------------------------------
// Market data normalization
// ---------------------------------------------------------------------------

function normalizeMarketData(raw: RawMarketData | undefined): MarketData {
  if (!raw) {
    return {
      currentPriceUsd: null,
      priceChange24hPercent: null,
      marketCap: null,
      totalVolume24h: null,
      circulatingSupply: null,
      fullyDilutedValuation: null,
    };
  }

  return {
    currentPriceUsd: parseNum(raw.current_price?.usd),
    priceChange24hPercent: parseNum(raw.price_change_percentage_24h),
    marketCap: parseNum(raw.market_cap?.usd),
    totalVolume24h: parseNum(raw.total_volume?.usd),
    circulatingSupply: parseNum(raw.circulating_supply),
    fullyDilutedValuation: parseNum(raw.fully_diluted_valuation?.usd),
  };
}

// ---------------------------------------------------------------------------
// Search — CoinGecko /search endpoint
// ---------------------------------------------------------------------------

/**
 * Search CoinGecko for coins matching a query string.
 * Returns normalized SearchResult[] — all parsing done here.
 */
export async function searchCoins(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const url = `${COINGECKO_BASE}/search?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: buildHeaders() });

  if (!res.ok) {
    throw new UpstreamError(classifyHttpStatus(res.status), res.status, "coingecko");
  }

  const data: RawSearchResponse = await res.json();

  return (data.coins ?? []).map((coin): SearchResult => ({
    coinId: coin.id,
    name: coin.name,
    symbol: coin.symbol,
    thumbUrl: coin.thumb,
    marketCapRank: coin.market_cap_rank ?? null,
    platforms: normalizePlatforms(coin.platforms),
  }));
}

// ---------------------------------------------------------------------------
// Coin Detail — CoinGecko /coins/{id} endpoint
// ---------------------------------------------------------------------------

/** Coin detail with platforms map for resolving contract addresses. */
export interface TokenDetail {
  token: Token;
  platforms: Record<string, string>;
  marketDataStatus?: TokenMarketDataStatus;
}

export type TokenMarketDataCacheStatus =
  | "disabled"
  | "hit"
  | "miss"
  | "refreshed"
  | "stale_fallback"
  | "unavailable";

export interface TokenMarketDataStatus {
  cacheStatus: TokenMarketDataCacheStatus;
  lastFetchedAt: string | null;
  cacheKey: string;
  ttlSeconds: number;
  fallbackError?: unknown;
}

/**
 * Fetch token metadata, market data, and platform addresses from CoinGecko.
 * Returns a normalized TokenDetail — no raw upstream shapes leak out.
 */
export async function getCoinDetail(coinId: string): Promise<TokenDetail> {
  const cacheKey = buildMarketCacheKey("coingecko:coin-detail", coinId);
  const ttlSeconds = getMarketCacheFreshTtlSeconds();
  const cacheEnabled = isRedisMarketCacheEnabled();
  let cachedEntry: MarketCacheEntry<TokenDetail> | null = null;
  let cacheUnavailable = false;

  if (cacheEnabled) {
    try {
      cachedEntry = await readMarketCacheEntry<TokenDetail>(cacheKey);

      if (cachedEntry && isFreshMarketCacheEntry(cachedEntry)) {
        return withMarketDataStatus(cachedEntry.value, {
          cacheStatus: "hit",
          lastFetchedAt: cachedEntry.fetchedAt,
          cacheKey,
          ttlSeconds,
        });
      }
    } catch {
      cacheUnavailable = true;
    }
  }

  try {
    const detail = await fetchCoinDetailFromUpstream(coinId);
    const fetchedAt = new Date().toISOString();

    if (cacheEnabled) {
      try {
        await writeMarketCacheEntry(cacheKey, detail, fetchedAt);
      } catch {
        cacheUnavailable = true;
      }
    }

    return withMarketDataStatus(detail, {
      cacheStatus: cacheUnavailable
        ? "unavailable"
        : cacheEnabled && cachedEntry
          ? "refreshed"
          : cacheEnabled
            ? "miss"
            : "disabled",
      lastFetchedAt: fetchedAt,
      cacheKey,
      ttlSeconds,
    });
  } catch (err) {
    if (cachedEntry) {
      return withMarketDataStatus(cachedEntry.value, {
        cacheStatus: "stale_fallback",
        lastFetchedAt: cachedEntry.fetchedAt,
        cacheKey,
        ttlSeconds,
        fallbackError: err,
      });
    }

    throw err;
  }
}

function withMarketDataStatus(
  detail: TokenDetail,
  status: TokenMarketDataStatus
): TokenDetail {
  return {
    ...detail,
    marketDataStatus: status,
  };
}

async function fetchCoinDetailFromUpstream(coinId: string): Promise<TokenDetail> {
  const url = `${COINGECKO_BASE}/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;
  const res = await fetch(url, { headers: buildHeaders() });

  if (!res.ok) {
    throw new UpstreamError(classifyHttpStatus(res.status), res.status, "coingecko");
  }

  const data: RawCoinDetail = await res.json();

  return {
    token: {
      coinId: data.id,
      name: data.name,
      symbol: data.symbol,
      thumbUrl: data.image?.thumb,
      imageUrl: data.image?.small ?? data.image?.thumb,
      marketCapRank: data.market_cap_rank ?? null,
      marketData: normalizeMarketData(data.market_data),
    },
    platforms: normalizePlatforms(data.platforms),
  };
}
