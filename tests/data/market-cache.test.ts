import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildMarketCacheKey,
  getMarketCacheFreshTtlSeconds,
  getMarketCacheStaleTtlSeconds,
  isFreshMarketCacheEntry,
} from "@/lib/api/market-cache";

const OLD_ENV = process.env;

afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.useRealTimers();
});

describe("market cache helpers", () => {
  it("builds stable Redis keys for provider-scoped market data", () => {
    expect(buildMarketCacheKey("coingecko:coin-detail", " Ethereum ")).toBe(
      "market:coingecko:coin-detail:ethereum",
    );
  });

  it("uses default TTLs when env vars are not set", () => {
    delete process.env.MARKET_DATA_CACHE_TTL_SECONDS;
    delete process.env.MARKET_DATA_STALE_CACHE_TTL_SECONDS;

    expect(getMarketCacheFreshTtlSeconds()).toBe(60);
    expect(getMarketCacheStaleTtlSeconds()).toBe(3600);
  });

  it("keeps stale TTL at least as long as the fresh TTL", () => {
    process.env.MARKET_DATA_CACHE_TTL_SECONDS = "120";
    process.env.MARKET_DATA_STALE_CACHE_TTL_SECONDS = "30";

    expect(getMarketCacheFreshTtlSeconds()).toBe(120);
    expect(getMarketCacheStaleTtlSeconds()).toBe(120);
  });

  it("classifies cache entries by fetchedAt age", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T12:01:00.000Z"));
    process.env.MARKET_DATA_CACHE_TTL_SECONDS = "60";

    expect(
      isFreshMarketCacheEntry({
        value: { coinId: "ethereum" },
        fetchedAt: "2026-04-28T12:00:30.000Z",
      }),
    ).toBe(true);

    expect(
      isFreshMarketCacheEntry({
        value: { coinId: "ethereum" },
        fetchedAt: "2026-04-28T11:59:00.000Z",
      }),
    ).toBe(false);
  });
});
