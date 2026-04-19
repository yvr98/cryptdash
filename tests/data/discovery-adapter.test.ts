// =============================================================================
// TokenScope — Discovery Adapter Test
// =============================================================================
//
// Tests that the GeckoTerminal trending-pools adapter boundary correctly:
// - Calls the right endpoint with required params/headers
// - Preserves upstream order exactly
// - Converts malformed optional numerics/timestamps into null-safe values
// =============================================================================

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchTrendingPools,
  normalizeTrendingPool,
} from "@/lib/api/geckoterminal";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Fixture: healthy trending-pools response (multi-chain, ordered)
// ---------------------------------------------------------------------------

const healthyTrendingResponse = {
  data: [
    {
      id: "eth_0xaaa",
      type: "pool",
      attributes: {
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        name: "PEPE / WETH",
        reserve_in_usd: "1200000.50",
        volume_usd: { h24: "340000.00" },
        transactions: { h24: "890" },
        pool_created_at: "2024-06-15T12:00:00Z",
      },
      relationships: {
        network: { data: { id: "eth" } },
        dex: { data: { id: "uniswap_v3" } },
      },
    },
    {
      id: "base_0xbbb",
      type: "pool",
      attributes: {
        address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        name: "BRETT / WETH",
        reserve_in_usd: "800000.00",
        volume_usd: { h24: "210000.00" },
        transactions: { h24: { buys: 450, sells: 320 } },
        pool_created_at: "2024-08-01T00:00:00Z",
      },
      relationships: {
        network: { data: { id: "base" } },
        dex: { data: { id: "aerodrome" } },
      },
    },
    {
      id: "arbitrum_0xccc",
      type: "pool",
      attributes: {
        address: "0xcccccccccccccccccccccccccccccccccccccccc",
        name: "ARB / USDC",
        reserve_in_usd: "500000.00",
        volume_usd: { h24: "150000.00" },
        transaction_count: { h24: "200" },
        pool_created_at: "2023-03-23T00:00:00Z",
      },
      relationships: {
        network: { data: { id: "arbitrum" } },
        dex: { data: { id: "camelot" } },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// normalizeTrendingPool
// ---------------------------------------------------------------------------

describe("normalizeTrendingPool", () => {
  it("parses a healthy pool with string transactions", () => {
    const row = normalizeTrendingPool(healthyTrendingResponse.data[0]);
    expect(row).not.toBeNull();
    expect(row!.poolAddress).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(row!.pairLabel).toBe("PEPE / WETH");
    expect(row!.networkId).toBe("eth");
    expect(row!.chainId).toBe(1);
    expect(row!.dexName).toBe("uniswap_v3");
    expect(row!.liquidityUsd).toBe(1200000.5);
    expect(row!.volume24hUsd).toBe(340000.0);
    expect(row!.transactions24h).toBe(890);
    expect(row!.poolCreatedAt).toBe("2024-06-15T12:00:00Z");
  });

  it("parses a pool with object-shaped transactions (buys + sells)", () => {
    const row = normalizeTrendingPool(healthyTrendingResponse.data[1]);
    expect(row).not.toBeNull();
    expect(row!.networkId).toBe("base");
    expect(row!.chainId).toBe(8453);
    expect(row!.transactions24h).toBe(770); // 450 + 320
  });

  it("parses a pool using legacy transaction_count field", () => {
    const row = normalizeTrendingPool(healthyTrendingResponse.data[2]);
    expect(row).not.toBeNull();
    expect(row!.networkId).toBe("arbitrum");
    expect(row!.chainId).toBe(42161);
    expect(row!.transactions24h).toBe(200);
  });

  it("returns null for an unsupported network (chainId is null, but still valid)", () => {
    const unsupportedPool = {
      id: "sol_0xddd",
      type: "pool",
      attributes: {
        address: "0xdddddddddddddddddddddddddddddddddddddddd",
        name: "SOL / USDC",
        reserve_in_usd: "50000.00",
        volume_usd: { h24: "10000.00" },
        transactions: { h24: "50" },
        pool_created_at: "2024-01-01T00:00:00Z",
      },
      relationships: {
        network: { data: { id: "solana" } },
        dex: { data: { id: "raydium" } },
      },
    };

    const row = normalizeTrendingPool(unsupportedPool);
    expect(row).not.toBeNull();
    expect(row!.networkId).toBe("solana");
    expect(row!.chainId).toBeNull();
  });

  it("returns null when address is missing", () => {
    const noAddress = {
      id: "x",
      type: "pool",
      attributes: { name: "FOO / BAR" },
      relationships: {
        network: { data: { id: "eth" } },
        dex: { data: { id: "uniswap_v3" } },
      },
    };
    expect(normalizeTrendingPool(noAddress)).toBeNull();
  });

  it("returns null when name is missing", () => {
    const noName = {
      id: "x",
      type: "pool",
      attributes: { address: "0xabc" },
      relationships: {
        network: { data: { id: "eth" } },
        dex: { data: { id: "uniswap_v3" } },
      },
    };
    expect(normalizeTrendingPool(noName)).toBeNull();
  });

  it("returns null when network relationship is missing", () => {
    const noNetwork = {
      id: "x",
      type: "pool",
      attributes: {
        address: "0xabc",
        name: "FOO / BAR",
      },
      relationships: {
        dex: { data: { id: "uniswap_v3" } },
      },
    };
    expect(normalizeTrendingPool(noNetwork)).toBeNull();
  });

  it("returns null when dex relationship is missing", () => {
    const noDex = {
      id: "x",
      type: "pool",
      attributes: {
        address: "0xabc",
        name: "FOO / BAR",
      },
      relationships: {
        network: { data: { id: "eth" } },
      },
    };
    expect(normalizeTrendingPool(noDex)).toBeNull();
  });

  it("converts null upstream numerics to null", () => {
    const nullPool = {
      id: "x",
      type: "pool",
      attributes: {
        address: "0xnull",
        name: "NULL / TOKEN",
        reserve_in_usd: null,
        volume_usd: { h24: null },
        transactions: { h24: null },
        pool_created_at: null,
      },
      relationships: {
        network: { data: { id: "eth" } },
        dex: { data: { id: "uniswap_v3" } },
      },
    };

    const row = normalizeTrendingPool(nullPool);
    expect(row).not.toBeNull();
    expect(row!.liquidityUsd).toBeNull();
    expect(row!.volume24hUsd).toBeNull();
    expect(row!.transactions24h).toBeNull();
    expect(row!.poolCreatedAt).toBeNull();
  });

  it("handles completely missing optional fields gracefully", () => {
    const minimal = {
      id: "x",
      type: "pool",
      attributes: {
        address: "0xmin",
        name: "MIN / TOKEN",
      },
      relationships: {
        network: { data: { id: "eth" } },
        dex: { data: { id: "uniswap_v3" } },
      },
    };

    const row = normalizeTrendingPool(minimal);
    expect(row).not.toBeNull();
    expect(row!.liquidityUsd).toBeNull();
    expect(row!.volume24hUsd).toBeNull();
    expect(row!.transactions24h).toBeNull();
    expect(row!.poolCreatedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fetchTrendingPools — request params and preserved order
// ---------------------------------------------------------------------------

describe("fetchTrendingPools", () => {
  it("calls GeckoTerminal public trending-pools endpoint with required params and Accept header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => healthyTrendingResponse,
    });

    vi.stubGlobal("fetch", fetchMock);

    const rows = await fetchTrendingPools();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];

    // URL checks
    expect(url).toContain("https://api.geckoterminal.com/api/v2/networks/trending_pools");
    expect(url).toContain("duration=24h");
    expect(url).toContain("include=base_token%2Cquote_token%2Cdex%2Cnetwork");
    expect(url).toContain("include_gt_community_data=false");
    expect(url).toContain("page=1");

    // Header checks
    expect(opts.headers).toEqual({ Accept: "application/json;version=20230203" });

    // Result checks
    expect(rows).toHaveLength(3);
  });

  it("preserves exact upstream order in returned rows", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => healthyTrendingResponse,
    });

    vi.stubGlobal("fetch", fetchMock);

    const rows = await fetchTrendingPools();

    expect(rows).toHaveLength(3);
    expect(rows[0].poolAddress).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(rows[1].poolAddress).toBe("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(rows[2].poolAddress).toBe("0xcccccccccccccccccccccccccccccccccccccccc");
  });

  it("filters out pools missing required identity fields without throwing", async () => {
    const mixedResponse = {
      data: [
        healthyTrendingResponse.data[0],
        { id: "bad", type: "pool", attributes: {} },
        healthyTrendingResponse.data[1],
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mixedResponse,
    });

    vi.stubGlobal("fetch", fetchMock);

    const rows = await fetchTrendingPools();

    expect(rows).toHaveLength(2);
    expect(rows[0].poolAddress).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(rows[1].poolAddress).toBe("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  });

  it("returns empty array for empty upstream data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const rows = await fetchTrendingPools();
    expect(rows).toEqual([]);
  });

  it("returns empty array when data key is missing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    vi.stubGlobal("fetch", fetchMock);

    const rows = await fetchTrendingPools();
    expect(rows).toEqual([]);
  });

  it("throws UpstreamError on non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchTrendingPools()).rejects.toThrow();
  });

  it("handles malformed payloads with bad numeric values safely", async () => {
    const malformedResponse = {
      data: [
        {
          id: "x",
          type: "pool",
          attributes: {
            address: "0xbadnum",
            name: "BAD / NUM",
            reserve_in_usd: "not_a_number",
            volume_usd: { h24: "" },
            transactions: { h24: NaN },
            pool_created_at: "",
          },
          relationships: {
            network: { data: { id: "polygon_pos" } },
            dex: { data: { id: "quickswap" } },
          },
        },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => malformedResponse,
    });

    vi.stubGlobal("fetch", fetchMock);

    const rows = await fetchTrendingPools();
    expect(rows).toHaveLength(1);
    expect(rows[0].liquidityUsd).toBeNull();
    expect(rows[0].volume24hUsd).toBeNull();
    expect(rows[0].transactions24h).toBeNull();
    expect(rows[0].poolCreatedAt).toBeNull();
    // Identity fields still parse correctly
    expect(rows[0].networkId).toBe("polygon_pos");
    expect(rows[0].chainId).toBe(137);
  });
});
