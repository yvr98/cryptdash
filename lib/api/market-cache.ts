// =============================================================================
// CryptDash — Market Data Cache
// =============================================================================
//
// Lazy Upstash Redis adapter for shared market-data cache entries.
// The client is created only when first used so Next.js builds do not require
// Redis environment variables.
// =============================================================================

import { Redis } from "@upstash/redis";

export const DEFAULT_MARKET_CACHE_FRESH_TTL_SECONDS = 60;
export const DEFAULT_MARKET_CACHE_STALE_TTL_SECONDS = 60 * 60;

export interface MarketCacheEntry<T> {
  value: T;
  fetchedAt: string;
}

let redisClient: Redis | null | undefined;

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getMarketCacheFreshTtlSeconds(): number {
  return readPositiveIntEnv(
    "MARKET_DATA_CACHE_TTL_SECONDS",
    DEFAULT_MARKET_CACHE_FRESH_TTL_SECONDS
  );
}

export function getMarketCacheStaleTtlSeconds(): number {
  return Math.max(
    readPositiveIntEnv(
      "MARKET_DATA_STALE_CACHE_TTL_SECONDS",
      DEFAULT_MARKET_CACHE_STALE_TTL_SECONDS
    ),
    getMarketCacheFreshTtlSeconds()
  );
}

export function isRedisMarketCacheEnabled(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

function getRedisClient(): Redis | null {
  if (!isRedisMarketCacheEnabled()) {
    return null;
  }

  if (redisClient === undefined) {
    redisClient = Redis.fromEnv();
  }

  return redisClient;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMarketCacheEntry<T>(value: unknown): value is MarketCacheEntry<T> {
  return (
    isRecord(value) &&
    "value" in value &&
    typeof value.fetchedAt === "string" &&
    !Number.isNaN(Date.parse(value.fetchedAt))
  );
}

export function isFreshMarketCacheEntry(
  entry: MarketCacheEntry<unknown>,
  now = Date.now()
): boolean {
  const fetchedAtMs = Date.parse(entry.fetchedAt);

  if (Number.isNaN(fetchedAtMs)) {
    return false;
  }

  return now - fetchedAtMs <= getMarketCacheFreshTtlSeconds() * 1000;
}

export function buildMarketCacheKey(provider: string, id: string): string {
  return `market:${provider}:${encodeURIComponent(id.trim().toLowerCase())}`;
}

export async function readMarketCacheEntry<T>(
  key: string
): Promise<MarketCacheEntry<T> | null> {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  const entry = await redis.get<unknown>(key);
  return isMarketCacheEntry<T>(entry) ? entry : null;
}

export async function writeMarketCacheEntry<T>(
  key: string,
  value: T,
  fetchedAt: string
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  await redis.set(
    key,
    {
      value,
      fetchedAt,
    } satisfies MarketCacheEntry<T>,
    { ex: getMarketCacheStaleTtlSeconds() }
  );
}

export function resetMarketCacheClientForTests(): void {
  redisClient = undefined;
}
