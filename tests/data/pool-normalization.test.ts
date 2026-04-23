// =============================================================================
// CryptDash — Pool Normalization Test
// =============================================================================
//
// Tests that the GeckoTerminal adapter boundary correctly parses pool
// numeric strings and nulls into proper number | null types.
// All upstream string/null parsing must happen at the adapter boundary
// and never leak into downstream code.
// =============================================================================

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  rawPoolResponse,
  rawPoolWithNulls,
  rawPoolWithNumericTxCount,
  rawPoolWithObjectTxCount,
  rawPoolMissingIdentity,
  expectedNormalizedPools,
} from "@/tests/fixtures/geckoterminal";

import {
  fetchPoolsForToken,
  normalizePool,
  parseNum,
} from "@/lib/api/geckoterminal";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("pool adapter normalizes onchain pool attributes", () => {
  it("parses string-valued pool metrics into numbers", () => {
    const pools = rawPoolResponse.data.map((raw) =>
      normalizePool(raw, 1 as const)
    );

    expect(pools).toHaveLength(2);

    for (const pool of pools) {
      expect(pool).not.toBeNull();
      // All numeric fields must be number | null — never string
      expect(typeof pool!.liquidityUsd === "number" || pool!.liquidityUsd === null).toBe(true);
      expect(typeof pool!.volume24hUsd === "number" || pool!.volume24hUsd === null).toBe(true);
      expect(typeof pool!.transactions24h === "number" || pool!.transactions24h === null).toBe(true);
      expect(typeof pool!.priceChange24h === "number" || pool!.priceChange24h === null).toBe(true);
    }
  });

  it("matches expected normalized pool fixture", () => {
    const pools = rawPoolResponse.data.map((raw) =>
      normalizePool(raw, 1 as const)
    );

    expect(pools).toEqual(expectedNormalizedPools);
  });

  it("converts null upstream metrics to null in output", () => {
    const pools = rawPoolWithNulls.data.map((raw) =>
      normalizePool(raw, 1 as const)
    );

    expect(pools).toHaveLength(1);
    const pool = pools[0]!;
    expect(pool).not.toBeNull();
    expect(pool.baseTokenPriceUsd).toBeNull();
    expect(pool.quoteTokenPriceUsd).toBeNull();
    expect(pool.liquidityUsd).toBeNull();
    expect(pool.volume24hUsd).toBeNull();
    expect(pool.transactions24h).toBeNull();
    expect(pool.priceChange24h).toBeNull();
  });

  it("handles numeric (non-string) transaction counts", () => {
    const pools = rawPoolWithNumericTxCount.data.map((raw) =>
      normalizePool(raw, 1 as const)
    );

    expect(pools).toHaveLength(1);
    expect(pools[0]!.transactions24h).toBe(500);
    expect(typeof pools[0]!.transactions24h).toBe("number");
  });

  it("derives transactions24h from object-shaped transactions.h24 (buys + sells)", () => {
    const pools = rawPoolWithObjectTxCount.data.map((raw) =>
      normalizePool(raw, 1 as const)
    );

    expect(pools).toHaveLength(1);
    expect(pools[0]!.transactions24h).toBe(1470); // 850 + 620
    expect(typeof pools[0]!.transactions24h).toBe("number");
  });

  it("returns null for pools missing required identity fields", () => {
    for (const raw of rawPoolMissingIdentity.data) {
      expect(normalizePool(raw, 1 as const)).toBeNull();
    }
  });

  it("preserves identity fields (address, dexName, pairLabel, chainId)", () => {
    const pool = normalizePool(rawPoolResponse.data[0], 1 as const);
    expect(pool).not.toBeNull();
    expect(pool!.poolAddress).toBe("0x1111111111111111111111111111111111111111");
    expect(pool!.dexName).toBe("uniswap_v3");
    expect(pool!.pairLabel).toBe("WETH / USDC");
    expect(pool!.chainId).toBe(1);
  });

  it("extracts dexName from relationships.dex.data.id when present", () => {
    const liveShapePool = {
      id: "0xlive",
      type: "pool",
      attributes: {
        address: "0xliveaddress",
        name: "TOKEN / USDC",
        // No dex_id attribute — live API puts it in relationships
        base_token_price_usd: "100.00",
        quote_token_price_usd: "1.00",
        reserve_in_usd: "500000.00",
        volume_usd: { h24: "50000.00" },
        transactions: { h24: "300" },
        price_change_percentage: { h24: "1.00" },
      },
      relationships: {
        dex: { data: { id: "sushiswap" } },
      },
    };

    const pool = normalizePool(liveShapePool, 1 as const);
    expect(pool).not.toBeNull();
    expect(pool!.dexName).toBe("sushiswap");
    expect(pool!.transactions24h).toBe(300);
  });

  it("falls back to attributes.dex_id for backward compat", () => {
    const legacyPool = {
      id: "0xlegacy",
      type: "pool",
      attributes: {
        address: "0xlegacyaddress",
        name: "OLD / USDC",
        dex_id: "uniswap",
        base_token_price_usd: "50.00",
        quote_token_price_usd: "1.00",
        reserve_in_usd: "100000.00",
        volume_usd: { h24: "10000.00" },
        transaction_count: { h24: "80" },
        price_change_percentage: { h24: "0.50" },
      },
      // No relationships.dex at all
    };

    const pool = normalizePool(legacyPool, 1 as const);
    expect(pool).not.toBeNull();
    expect(pool!.dexName).toBe("uniswap");
    expect(pool!.transactions24h).toBe(80);
  });

  it("returns null when neither relationships.dex nor attributes.dex_id exists", () => {
    const noDexPool = {
      id: "0xnodex",
      type: "pool",
      attributes: {
        address: "0xnodexaddress",
        name: "NO / DEX",
      },
      relationships: {},
    };

    expect(normalizePool(noDexPool, 1 as const)).toBeNull();
  });
});

describe("parseNum handles edge cases at adapter boundary", () => {
  it("parses string numbers correctly", () => {
    expect(parseNum("123.45")).toBe(123.45);
    expect(parseNum("0")).toBe(0);
    expect(parseNum("-5.5")).toBe(-5.5);
  });

  it("passes through numeric values", () => {
    expect(parseNum(42)).toBe(42);
    expect(parseNum(0)).toBe(0);
    expect(parseNum(3.14)).toBe(3.14);
  });

  it("returns null for null and undefined", () => {
    expect(parseNum(null)).toBeNull();
    expect(parseNum(undefined)).toBeNull();
  });

  it("returns null for non-finite values", () => {
    expect(parseNum(Infinity)).toBeNull();
    expect(parseNum(-Infinity)).toBeNull();
    expect(parseNum(NaN)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseNum("")).toBeNull();
  });

  it("returns null for non-numeric strings", () => {
    expect(parseNum("abc")).toBeNull();
    expect(parseNum("12abc")).toBeNull();
  });
});

describe("fetchPoolsForToken", () => {
  it("calls CoinGecko onchain token pools endpoint for the given contract address", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => rawPoolResponse,
    });

    vi.stubGlobal("fetch", fetchMock);

    const pools = await fetchPoolsForToken(
      "eth",
      1 as const,
      "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.coingecko.com/api/v3/onchain/networks/eth/tokens/0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2/pools",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
        }),
      })
    );
    expect(pools).toEqual(expectedNormalizedPools);
  });

  it("omits the demo API key header when COINGECKO_API_KEY is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => rawPoolResponse,
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("COINGECKO_API_KEY", "");

    await fetchPoolsForToken(
      "eth",
      1 as const,
      "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.coingecko.com/api/v3/onchain/networks/eth/tokens/0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2/pools",
      expect.objectContaining({
        headers: expect.not.objectContaining({
          "x-cg-demo-api-key": expect.any(String),
        }),
      })
    );
  });

  it("adds the demo API key header when COINGECKO_API_KEY is present", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => rawPoolResponse,
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("COINGECKO_API_KEY", "test-demo-key");

    await fetchPoolsForToken(
      "base",
      8453 as const,
      "0x4200000000000000000000000000000000000006"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.coingecko.com/api/v3/onchain/networks/base/tokens/0x4200000000000000000000000000000000000006/pools",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
          "x-cg-demo-api-key": "test-demo-key",
        }),
      })
    );
  });
});
