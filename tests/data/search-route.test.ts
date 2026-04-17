import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchCoins = vi.fn();
const getCoinDetail = vi.fn();

vi.mock("@/lib/api/coingecko", () => ({
  searchCoins,
  getCoinDetail,
}));

describe("search route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates blank search results with supported-chain platforms", async () => {
    searchCoins.mockResolvedValueOnce([
      {
        coinId: "ethereum",
        name: "Ethereum",
        symbol: "ETH",
        marketCapRank: 1,
        platforms: {},
      },
    ]);

    getCoinDetail.mockResolvedValueOnce({
      token: {
        coinId: "ethereum",
        name: "Ethereum",
        symbol: "ETH",
        marketCapRank: 1,
      },
      platforms: {
        ethereum: "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2",
        base: "0x4200000000000000000000000000000000000006",
      },
    });

    const { GET } = await import("@/app/api/search/route");
    const response = await GET(
      new NextRequest("http://127.0.0.1:3000/api/search?q=ethereum")
    );

    const body = await response.json();

    expect(body).toHaveLength(1);
    expect(body[0]?.platforms).toEqual({
      ethereum: "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2",
      base: "0x4200000000000000000000000000000000000006",
    });
  });

  it("adds wrapped bitcoin as a supported-chain alias and ranks it first", async () => {
    searchCoins.mockResolvedValueOnce([
      {
        coinId: "bitcoin",
        name: "Bitcoin",
        symbol: "BTC",
        marketCapRank: 1,
        platforms: {},
      },
    ]);

    getCoinDetail.mockImplementation(async (coinId: string) => {
      if (coinId === "bitcoin") {
        return {
          token: {
            coinId: "bitcoin",
            name: "Bitcoin",
            symbol: "BTC",
            marketCapRank: 1,
          },
          platforms: {},
        };
      }

      if (coinId === "wrapped-bitcoin") {
        return {
          token: {
            coinId: "wrapped-bitcoin",
            name: "Wrapped Bitcoin",
            symbol: "WBTC",
            marketCapRank: 25,
          },
          platforms: {
            ethereum: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
            base: "0x1cea84203673764244e05693e42e6ace62be9ba5",
          },
        };
      }

      throw new Error(`Unexpected coinId: ${coinId}`);
    });

    const { GET } = await import("@/app/api/search/route");
    const response = await GET(
      new NextRequest("http://127.0.0.1:3000/api/search?q=bitcoin")
    );

    const body = await response.json();

    expect(body.map((result: { coinId: string }) => result.coinId)).toEqual([
      "wrapped-bitcoin",
      "bitcoin",
    ]);
  });
});
