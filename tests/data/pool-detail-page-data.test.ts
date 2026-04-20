// =============================================================================
// TokenScope — Pool Detail Page Data Tests
// =============================================================================
//
// Tests the server-side pool detail page model that powers
// /pool/[network]/[poolAddress].
// =============================================================================

import { describe, expect, it } from "vitest";

import { UpstreamError } from "@/lib/api/upstream-error";
import { getPoolDetailPageData } from "@/lib/page-data/pool-detail";
import type { PoolRecord } from "@/lib/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Reference timestamp for deterministic freshness tests. */
const REFERENCE_NOW = 1_700_000_000_000;

function createPoolRecordFixture(
  overrides: Partial<PoolRecord> = {},
): PoolRecord {
  return {
    poolAddress: "0xabc1230000000000000000000000000000000001",
    networkId: "eth",
    chainId: 1,
    dexName: "Uniswap V3",
    pairLabel: "WETH / USDC",
    baseTokenPriceUsd: 2500.5,
    quoteTokenPriceUsd: 1.0,
    liquidityUsd: 12_500_000,
    volume24hUsd: 3_400_000,
    transactions24h: 1234,
    priceChange24h: 2.5,
    poolCreatedAt: new Date(REFERENCE_NOW - 30 * MS_PER_DAY).toISOString(),
    ...overrides,
  };
}

/** Fetcher that returns a fixed pool record. */
function happyFetcher(
  overrides: Partial<PoolRecord> = {},
): (network: string, poolAddress: string) => Promise<PoolRecord> {
  return async (_network, _poolAddress) =>
    createPoolRecordFixture(overrides);
}

/** Fetcher that throws UpstreamError("not_found"). */
function notFoundFetcher(): (
  network: string,
  poolAddress: string,
) => Promise<PoolRecord> {
  return async () => {
    throw new UpstreamError("not_found", 404, "geckoterminal");
  };
}

/** Fetcher that throws UpstreamError("rate_limited"). */
function rateLimitedFetcher(): (
  network: string,
  poolAddress: string,
) => Promise<PoolRecord> {
  return async () => {
    throw new UpstreamError("rate_limited", 429, "geckoterminal");
  };
}

/** Fetcher that throws UpstreamError("server_error"). */
function serverErrorFetcher(): (
  network: string,
  poolAddress: string,
) => Promise<PoolRecord> {
  return async () => {
    throw new UpstreamError("server_error", 503, "geckoterminal");
  };
}

/** Fetcher that throws a generic non-UpstreamError. */
function genericErrorFetcher(): (
  network: string,
  poolAddress: string,
) => Promise<PoolRecord> {
  return async () => {
    throw new Error("Something went wrong");
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getPoolDetailPageData", () => {
  // --- Happy path ---

  it("returns complete page model with full pool data", async () => {
    const pool = createPoolRecordFixture();
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc1230000000000000000000000000000000001",
      undefined,
      happyFetcher(),
      REFERENCE_NOW,
    );

    expect(result.pool).toEqual(pool);
    expect(result.dataState.status).toBe("complete");
    expect(result.dataState.errors).toEqual([]);
    expect(result.backlink).toBeNull();
  });

  // --- Freshness buckets ---

  it("classifies pool as New when created less than 24 hours ago", async () => {
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      happyFetcher({
        poolCreatedAt: new Date(REFERENCE_NOW - 12 * MS_PER_HOUR).toISOString(),
      }),
      REFERENCE_NOW,
    );

    expect(result.freshness).toBe("New");
  });

  it("classifies pool as Recent when created less than 7 days ago", async () => {
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      happyFetcher({
        poolCreatedAt: new Date(REFERENCE_NOW - 3 * MS_PER_DAY).toISOString(),
      }),
      REFERENCE_NOW,
    );

    expect(result.freshness).toBe("Recent");
  });

  it("classifies pool as Established when created 7 or more days ago", async () => {
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      happyFetcher({
        poolCreatedAt: new Date(REFERENCE_NOW - 30 * MS_PER_DAY).toISOString(),
      }),
      REFERENCE_NOW,
    );

    expect(result.freshness).toBe("Established");
  });

  it("classifies pool as Unknown when poolCreatedAt is null", async () => {
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      happyFetcher({ poolCreatedAt: null }),
      REFERENCE_NOW,
    );

    expect(result.freshness).toBe("Unknown");
  });

  it("classifies pool as Unknown when poolCreatedAt is empty string", async () => {
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      happyFetcher({ poolCreatedAt: "" as unknown as null }),
      REFERENCE_NOW,
    );

    expect(result.freshness).toBe("Unknown");
  });

  // --- Not-found propagation ---

  it("propagates UpstreamError not_found for route-level notFound()", async () => {
    await expect(
      getPoolDetailPageData(
        "eth",
        "0xnonexistent",
        undefined,
        notFoundFetcher(),
      ),
    ).rejects.toThrow();

    try {
      await getPoolDetailPageData(
        "eth",
        "0xnonexistent",
        undefined,
        notFoundFetcher(),
      );
    } catch (err) {
      expect(err).toBeInstanceOf(UpstreamError);
      expect((err as UpstreamError).category).toBe("not_found");
    }
  });

  // --- Degraded states ---

  it("returns degraded stub pool on rate_limited error", async () => {
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc1230000000000000000000000000000000001",
      undefined,
      rateLimitedFetcher(),
      REFERENCE_NOW,
    );

    expect(result.dataState.status).toBe("upstream_error");
    expect(result.dataState.errors).toHaveLength(1);
    expect(result.dataState.errors[0]!.category).toBe("rate_limited");
    expect(result.dataState.errors[0]!.source).toBe("geckoterminal");

    // Stub pool preserves identity from input
    expect(result.pool.poolAddress).toBe(
      "0xabc1230000000000000000000000000000000001",
    );
    expect(result.pool.networkId).toBe("eth");
    expect(result.pool.chainId).toBe(1); // resolved from SUPPORTED_CHAIN_LIST

    // Market signals degrade honestly to null
    expect(result.pool.liquidityUsd).toBeNull();
    expect(result.pool.volume24hUsd).toBeNull();
    expect(result.pool.transactions24h).toBeNull();
    expect(result.pool.priceChange24h).toBeNull();
    expect(result.pool.baseTokenPriceUsd).toBeNull();
    expect(result.pool.quoteTokenPriceUsd).toBeNull();
    expect(result.pool.poolCreatedAt).toBeNull();
    expect(result.pool.dexName).toBe("");
    expect(result.pool.pairLabel).toBe("");

    // Freshness is Unknown for stub pool
    expect(result.freshness).toBe("Unknown");
  });

  it("returns degraded stub pool on server_error", async () => {
    const result = await getPoolDetailPageData(
      "base",
      "0xdef456",
      undefined,
      serverErrorFetcher(),
      REFERENCE_NOW,
    );

    expect(result.dataState.status).toBe("upstream_error");
    expect(result.dataState.errors[0]!.category).toBe("server_error");
    expect(result.pool.networkId).toBe("base");
    expect(result.pool.chainId).toBe(8453);
  });

  it("returns degraded stub pool on generic non-UpstreamError", async () => {
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      genericErrorFetcher(),
      REFERENCE_NOW,
    );

    expect(result.dataState.status).toBe("upstream_error");
    expect(result.dataState.errors).toHaveLength(1);
    expect(result.dataState.errors[0]!.category).toBe("server_error");
    expect(result.dataState.errors[0]!.source).toBe("unknown");
  });

  it("resolves null chainId for unsupported network in degraded state", async () => {
    const result = await getPoolDetailPageData(
      "solana",
      "SoLAnApOoL123",
      undefined,
      rateLimitedFetcher(),
      REFERENCE_NOW,
    );

    expect(result.pool.networkId).toBe("solana");
    expect(result.pool.chainId).toBeNull();
  });

  // --- Backlink ---

  it("includes backlink when coinId is provided", async () => {
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      "ethereum",
      happyFetcher(),
      REFERENCE_NOW,
    );

    expect(result.backlink).toEqual({
      coinId: "ethereum",
      tokenPath: "/token/ethereum",
    });
  });

  it("omits backlink when coinId is not provided", async () => {
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      happyFetcher(),
      REFERENCE_NOW,
    );

    expect(result.backlink).toBeNull();
  });

  it("omits backlink when coinId is empty string", async () => {
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      "",
      happyFetcher(),
      REFERENCE_NOW,
    );

    expect(result.backlink).toBeNull();
  });

  // --- Partial metrics ---

  it("preserves null metrics from upstream without crashing", async () => {
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      happyFetcher({
        liquidityUsd: null,
        volume24hUsd: null,
        transactions24h: null,
        priceChange24h: null,
        baseTokenPriceUsd: null,
        quoteTokenPriceUsd: null,
        poolCreatedAt: null,
      }),
      REFERENCE_NOW,
    );

    expect(result.dataState.status).toBe("complete");
    expect(result.pool.liquidityUsd).toBeNull();
    expect(result.pool.volume24hUsd).toBeNull();
    expect(result.pool.transactions24h).toBeNull();
    expect(result.pool.priceChange24h).toBeNull();
    expect(result.pool.baseTokenPriceUsd).toBeNull();
    expect(result.pool.quoteTokenPriceUsd).toBeNull();
    expect(result.freshness).toBe("Unknown");
  });

  // --- Not-found vs degraded distinction ---

  it("distinguishes not-found from degraded: not-found throws, degraded returns model", async () => {
    // Not-found: throws
    await expect(
      getPoolDetailPageData(
        "eth",
        "0xmissing",
        undefined,
        notFoundFetcher(),
      ),
    ).rejects.toThrow();

    // Degraded: returns a model with upstream_error status
    const degraded = await getPoolDetailPageData(
      "eth",
      "0xrateLimited",
      undefined,
      rateLimitedFetcher(),
      REFERENCE_NOW,
    );
    expect(degraded.dataState.status).toBe("upstream_error");
    expect(degraded.pool).toBeDefined();
  });


  // --- Freshness boundary precision ---

  it("classifies pool as Recent when created exactly 24 hours ago", async () => {
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      happyFetcher({
        poolCreatedAt: new Date(REFERENCE_NOW - MS_PER_DAY).toISOString(),
      }),
      REFERENCE_NOW,
    );

    // Exactly at the boundary: ageMs === NEW_THRESHOLD_MS, so not < NEW_THRESHOLD_MS
    expect(result.freshness).toBe("Recent");
  });

  it("classifies pool as Established when created exactly 7 days ago", async () => {
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      happyFetcher({
        poolCreatedAt: new Date(REFERENCE_NOW - 7 * MS_PER_DAY).toISOString(),
      }),
      REFERENCE_NOW,
    );

    // Exactly at the boundary: ageMs === RECENT_THRESHOLD_MS, so not < RECENT_THRESHOLD_MS
    expect(result.freshness).toBe("Established");
  });

  it("classifies pool as Unknown when poolCreatedAt is unparseable", async () => {
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      happyFetcher({ poolCreatedAt: "not-a-date" as unknown as string }),
      REFERENCE_NOW,
    );

    expect(result.freshness).toBe("Unknown");
  });

  it("classifies pool as Unknown when poolCreatedAt is a future timestamp", async () => {
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      happyFetcher({
        poolCreatedAt: new Date(REFERENCE_NOW + MS_PER_DAY).toISOString(),
      }),
      REFERENCE_NOW,
    );

    // ageMs < 0 triggers the Unknown guard
    expect(result.freshness).toBe("Unknown");
  });

  // --- Supported chain resolution in degraded state ---

  it("resolves chainId for arbitrum in degraded state", async () => {
    const result = await getPoolDetailPageData(
      "arbitrum",
      "0xarbpool",
      undefined,
      rateLimitedFetcher(),
      REFERENCE_NOW,
    );

    expect(result.pool.networkId).toBe("arbitrum");
    expect(result.pool.chainId).toBe(42161);
  });

  it("resolves chainId for polygon_pos in degraded state", async () => {
    const result = await getPoolDetailPageData(
      "polygon_pos",
      "0xpolpool",
      undefined,
      rateLimitedFetcher(),
      REFERENCE_NOW,
    );

    expect(result.pool.networkId).toBe("polygon_pos");
    expect(result.pool.chainId).toBe(137);
  });

  it("resolves chainId for bsc in degraded state", async () => {
    const result = await getPoolDetailPageData(
      "bsc",
      "0xbscpool",
      undefined,
      rateLimitedFetcher(),
      REFERENCE_NOW,
    );

    expect(result.pool.networkId).toBe("bsc");
    expect(result.pool.chainId).toBe(56);
  });

  // --- Serializability ---

  it("returns a JSON-serializable model", async () => {
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      "ethereum",
      happyFetcher(),
      REFERENCE_NOW,
    );

    const serialized = JSON.parse(JSON.stringify(result));
    expect(serialized).toEqual(result);
  });
});
