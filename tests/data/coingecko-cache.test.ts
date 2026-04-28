import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCoinDetail } from "@/lib/api/coingecko";
import {
  resetMarketCacheClientForTests,
  type MarketCacheEntry,
} from "@/lib/api/market-cache";

type RedisStore = Map<string, MarketCacheEntry<unknown>>;

const redisStore: RedisStore = new Map();
const redisGet = vi.fn(async (key: string) => redisStore.get(key) ?? null);
const redisSet = vi.fn(
  async (key: string, value: MarketCacheEntry<unknown>) => {
    redisStore.set(key, value);
    return "OK";
  },
);

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => ({
      get: redisGet,
      set: redisSet,
    }),
  },
}));

const OLD_ENV = process.env;

function coinResponse(price = 3000) {
  return Response.json({
    id: "ethereum",
    symbol: "eth",
    name: "Ethereum",
    image: {
      thumb: "https://example.com/thumb.png",
      small: "https://example.com/small.png",
    },
    market_cap_rank: 1,
    platforms: {
      ethereum: "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2",
    },
    market_data: {
      current_price: { usd: price },
      price_change_percentage_24h: 2.5,
      market_cap: { usd: 360_000_000_000 },
      total_volume: { usd: 18_000_000_000 },
      circulating_supply: 120_000_000,
      fully_diluted_valuation: { usd: 360_000_000_000 },
    },
  });
}

beforeEach(() => {
  process.env = {
    ...OLD_ENV,
    UPSTASH_REDIS_REST_URL: "https://example-upstash.test",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    MARKET_DATA_CACHE_TTL_SECONDS: "60",
    MARKET_DATA_STALE_CACHE_TTL_SECONDS: "3600",
  };
  redisStore.clear();
  redisGet.mockClear();
  redisSet.mockClear();
  resetMarketCacheClientForTests();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-28T12:00:00.000Z"));
});

afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetMarketCacheClientForTests();
});

describe("getCoinDetail Redis market cache", () => {
  it("stores normalized CoinGecko detail after an upstream fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(coinResponse());
    vi.stubGlobal("fetch", fetchMock);

    const detail = await getCoinDetail("ethereum");

    expect(detail.marketDataStatus?.cacheStatus).toBe("miss");
    expect(detail.marketDataStatus?.lastFetchedAt).toBe(
      "2026-04-28T12:00:00.000Z",
    );
    expect(redisSet).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns fresh cached detail without calling CoinGecko", async () => {
    redisStore.set("market:coingecko:coin-detail:ethereum", {
      fetchedAt: "2026-04-28T11:59:30.000Z",
      value: {
        token: {
          coinId: "ethereum",
          name: "Ethereum",
          symbol: "eth",
          marketData: {
            currentPriceUsd: 2999,
            priceChange24hPercent: 1,
            marketCap: null,
            totalVolume24h: null,
            circulatingSupply: null,
            fullyDilutedValuation: null,
          },
        },
        platforms: { ethereum: "0xabc" },
      },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const detail = await getCoinDetail("ethereum");

    expect(detail.marketDataStatus?.cacheStatus).toBe("hit");
    expect(detail.marketDataStatus?.lastFetchedAt).toBe(
      "2026-04-28T11:59:30.000Z",
    );
    expect(detail.token.marketData?.currentPriceUsd).toBe(2999);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to stale cached detail when CoinGecko fails", async () => {
    redisStore.set("market:coingecko:coin-detail:ethereum", {
      fetchedAt: "2026-04-28T11:30:00.000Z",
      value: {
        token: {
          coinId: "ethereum",
          name: "Ethereum",
          symbol: "eth",
          marketData: {
            currentPriceUsd: 2500,
            priceChange24hPercent: -1,
            marketCap: null,
            totalVolume24h: null,
            circulatingSupply: null,
            fullyDilutedValuation: null,
          },
        },
        platforms: { ethereum: "0xabc" },
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 429 })));

    const detail = await getCoinDetail("ethereum");

    expect(detail.marketDataStatus?.cacheStatus).toBe("stale_fallback");
    expect(detail.marketDataStatus?.fallbackError).toBeInstanceOf(Error);
    expect(detail.token.marketData?.currentPriceUsd).toBe(2500);
  });
});
