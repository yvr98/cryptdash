// =============================================================================
// CryptDash — Pool Detail Page Data Tests
// =============================================================================
//
// Tests the server-side pool detail page model that powers
// /pool/[network]/[poolAddress].
// =============================================================================

import { describe, expect, it, vi } from "vitest";

import type { CapturePoolSnapshotResult } from "@/lib/api/rails-pool-snapshots";
import { UpstreamError } from "@/lib/api/upstream-error";
import {
  getPoolDetailPageData,
  type PoolDetailPageDataSideEffects,
} from "@/lib/page-data/pool-detail";
import type { PoolRecord, PoolSnapshotHistory } from "@/lib/types";

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

function createSideEffects(
  overrides: PoolDetailPageDataSideEffects = {},
): PoolDetailPageDataSideEffects &
  Required<Pick<
    PoolDetailPageDataSideEffects,
    "captureSnapshot" | "logCaptureFailure" | "readHistory"
  >> {
  return {
    captureSnapshot: overrides.captureSnapshot ?? vi.fn().mockResolvedValue({ status: "created", capturedAt: "2026-04-22T00:00:00.000Z" }),
    logCaptureFailure: overrides.logCaptureFailure ?? vi.fn(),
    readHistory:
      overrides.readHistory ??
      vi.fn().mockResolvedValue(createHistoryFixture()),
    includeHistory: overrides.includeHistory,
  };
}

function createHistoryFixture(
  overrides: Partial<PoolSnapshotHistory> = {},
): PoolSnapshotHistory {
  const rows = overrides.rows ?? [
    {
      capturedAt: "2026-04-21T22:00:00.000Z",
      liquidityUsd: 100,
      volume24hUsd: 10,
      transactions24h: 1,
    },
    {
      capturedAt: "2026-04-21T23:00:00.000Z",
      liquidityUsd: 200,
      volume24hUsd: 20,
      transactions24h: 2,
    },
    {
      capturedAt: "2026-04-22T00:00:00.000Z",
      liquidityUsd: 300,
      volume24hUsd: 30,
      transactions24h: 3,
    },
  ];

  return {
    windowHours: overrides.windowHours ?? 24,
    rowCount: overrides.rowCount ?? rows.length,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getPoolDetailPageData", () => {
  // --- Happy path ---

  it("returns complete page model with full pool data", async () => {
    const pool = createPoolRecordFixture();
    const sideEffects = createSideEffects();
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc1230000000000000000000000000000000001",
      undefined,
      happyFetcher(),
      REFERENCE_NOW,
      sideEffects,
    );

    expect(result.pool).toEqual(pool);
    expect(result.history).toEqual({
      state: "ready",
      cards: [
        {
          label: "Liquidity",
          state: "ready",
          latestValue: 300,
          delta: 200,
          points: [
            { timestamp: "2026-04-21T22:00:00.000Z", value: 100 },
            { timestamp: "2026-04-21T23:00:00.000Z", value: 200 },
            { timestamp: "2026-04-22T00:00:00.000Z", value: 300 },
          ],
        },
        {
          label: "24h Vol",
          state: "ready",
          latestValue: 30,
          delta: 20,
          points: [
            { timestamp: "2026-04-21T22:00:00.000Z", value: 10 },
            { timestamp: "2026-04-21T23:00:00.000Z", value: 20 },
            { timestamp: "2026-04-22T00:00:00.000Z", value: 30 },
          ],
        },
        {
          label: "24h Txs",
          state: "ready",
          latestValue: 3,
          delta: 2,
          points: [
            { timestamp: "2026-04-21T22:00:00.000Z", value: 1 },
            { timestamp: "2026-04-21T23:00:00.000Z", value: 2 },
            { timestamp: "2026-04-22T00:00:00.000Z", value: 3 },
          ],
        },
      ],
    });
    expect(result.dataState.status).toBe("complete");
    expect(result.dataState.errors).toEqual([]);
    expect(result.backlink).toBeNull();
    expect(sideEffects.captureSnapshot).toHaveBeenCalledTimes(1);
    expect(sideEffects.readHistory).toHaveBeenCalledTimes(1);
    expect(sideEffects.readHistory).toHaveBeenCalledWith({
      networkId: "eth",
      poolAddress: pool.poolAddress,
      hours: 24,
    });
    expect(sideEffects.captureSnapshot).toHaveBeenCalledWith({
      networkId: pool.networkId,
      poolAddress: pool.poolAddress,
      liquidityUsd: pool.liquidityUsd,
      volume24hUsd: pool.volume24hUsd,
      transactions24h: pool.transactions24h,
    });
  });

  it("can skip history reads so routes can stream that section separately", async () => {
    const sideEffects = createSideEffects({
      includeHistory: false,
      readHistory: vi.fn().mockRejectedValue(new Error("history should not block shell")),
    });

    const result = await getPoolDetailPageData(
      "eth",
      "0xabc1230000000000000000000000000000000001",
      undefined,
      happyFetcher(),
      REFERENCE_NOW,
      sideEffects,
    );

    expect(sideEffects.readHistory).not.toHaveBeenCalled();
    expect(result.history.state).toBe("unavailable");
    expect(result.pool.pairLabel).toBe("WETH / USDC");
  });

  it("does not await capture before returning the live page model", async () => {
    let resolveCapture:
      | ((value: CapturePoolSnapshotResult) => void)
      | undefined;
    const sideEffects = createSideEffects({
      captureSnapshot: vi.fn(
        () =>
          new Promise<CapturePoolSnapshotResult>((resolve) => {
            resolveCapture = resolve;
          }),
      ),
    });

    const resultPromise = getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      happyFetcher(),
      REFERENCE_NOW,
      sideEffects,
    );

    await expect(resultPromise).resolves.toMatchObject({
      dataState: { status: "complete", errors: [] },
      history: { state: "ready" },
      pool: createPoolRecordFixture(),
    });
    expect(sideEffects.captureSnapshot).toHaveBeenCalledTimes(1);

    resolveCapture?.({
      status: "created",
      capturedAt: "2026-04-22T00:00:00.000Z",
    });
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
    const sideEffects = createSideEffects();
    await expect(
      getPoolDetailPageData(
        "eth",
        "0xnonexistent",
        undefined,
        notFoundFetcher(),
        undefined,
        sideEffects,
      ),
    ).rejects.toThrow();

    try {
      await getPoolDetailPageData(
        "eth",
        "0xnonexistent",
        undefined,
        notFoundFetcher(),
        undefined,
        sideEffects,
      );
    } catch (err) {
      expect(err).toBeInstanceOf(UpstreamError);
      expect((err as UpstreamError).category).toBe("not_found");
    }

    expect(sideEffects.captureSnapshot).not.toHaveBeenCalled();
    expect(sideEffects.readHistory).not.toHaveBeenCalled();
    expect(sideEffects.logCaptureFailure).not.toHaveBeenCalled();
  });

  // --- Degraded states ---

  it("returns degraded stub pool on rate_limited error", async () => {
    const sideEffects = createSideEffects();
    const result = await getPoolDetailPageData(
      "eth",
      "0xabc1230000000000000000000000000000000001",
      undefined,
      rateLimitedFetcher(),
      REFERENCE_NOW,
      sideEffects,
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
    expect(result.history).toEqual({
      state: "unavailable",
      cards: [
        {
          label: "Liquidity",
          state: "sparse",
          latestValue: null,
          delta: null,
          points: [],
        },
        {
          label: "24h Vol",
          state: "sparse",
          latestValue: null,
          delta: null,
          points: [],
        },
        {
          label: "24h Txs",
          state: "sparse",
          latestValue: null,
          delta: null,
          points: [],
        },
      ],
    });
    expect(sideEffects.captureSnapshot).not.toHaveBeenCalled();
    expect(sideEffects.readHistory).not.toHaveBeenCalled();
    expect(sideEffects.logCaptureFailure).not.toHaveBeenCalled();
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
    const sideEffects = createSideEffects();
    // Not-found: throws
    await expect(
      getPoolDetailPageData(
        "eth",
        "0xmissing",
        undefined,
        notFoundFetcher(),
        undefined,
        sideEffects,
      ),
    ).rejects.toThrow();

    // Degraded: returns a model with upstream_error status
    const degraded = await getPoolDetailPageData(
      "eth",
      "0xrateLimited",
      undefined,
      rateLimitedFetcher(),
      REFERENCE_NOW,
      sideEffects,
    );
    expect(degraded.dataState.status).toBe("upstream_error");
    expect(degraded.pool).toBeDefined();
    expect(sideEffects.captureSnapshot).not.toHaveBeenCalled();
  });

  it("keeps returned live page data unchanged when capture fails and logs once", async () => {
    const pool = createPoolRecordFixture();
    const captureError = new Error("capture transport failed");
    const sideEffects = createSideEffects({
      captureSnapshot: vi.fn().mockRejectedValue(captureError),
      logCaptureFailure: vi.fn(),
    });

    const result = await getPoolDetailPageData(
      "eth",
      pool.poolAddress,
      "ethereum",
      happyFetcher(),
      REFERENCE_NOW,
      sideEffects,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result).toEqual({
      pool,
      freshness: "Established",
      backlink: {
        coinId: "ethereum",
        tokenPath: "/token/ethereum",
      },
      history: {
        state: "ready",
        cards: [
          {
            label: "Liquidity",
            state: "ready",
            latestValue: 300,
            delta: 200,
            points: [
              { timestamp: "2026-04-21T22:00:00.000Z", value: 100 },
              { timestamp: "2026-04-21T23:00:00.000Z", value: 200 },
              { timestamp: "2026-04-22T00:00:00.000Z", value: 300 },
            ],
          },
          {
            label: "24h Vol",
            state: "ready",
            latestValue: 30,
            delta: 20,
            points: [
              { timestamp: "2026-04-21T22:00:00.000Z", value: 10 },
              { timestamp: "2026-04-21T23:00:00.000Z", value: 20 },
              { timestamp: "2026-04-22T00:00:00.000Z", value: 30 },
            ],
          },
          {
            label: "24h Txs",
            state: "ready",
            latestValue: 3,
            delta: 2,
            points: [
              { timestamp: "2026-04-21T22:00:00.000Z", value: 1 },
              { timestamp: "2026-04-21T23:00:00.000Z", value: 2 },
              { timestamp: "2026-04-22T00:00:00.000Z", value: 3 },
            ],
          },
        ],
      },
      dataState: {
        status: "complete",
        errors: [],
      },
    });
    expect(sideEffects.captureSnapshot).toHaveBeenCalledTimes(1);
    expect(sideEffects.logCaptureFailure).toHaveBeenCalledTimes(1);
    expect(sideEffects.logCaptureFailure).toHaveBeenCalledWith(captureError, {
      networkId: pool.networkId,
      poolAddress: pool.poolAddress,
      liquidityUsd: pool.liquidityUsd,
      volume24hUsd: pool.volume24hUsd,
      transactions24h: pool.transactions24h,
    });
  });

  it("keeps returned live page data unchanged when capture is skipped", async () => {
    const sideEffects = createSideEffects({
      captureSnapshot: vi.fn().mockResolvedValue({
        status: "skipped",
        reason: "no_metrics",
      }),
    });

    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      happyFetcher({
        liquidityUsd: null,
        volume24hUsd: null,
        transactions24h: null,
        poolCreatedAt: null,
      }),
      REFERENCE_NOW,
      sideEffects,
    );

    expect(result.dataState).toEqual({
      status: "complete",
      errors: [],
    });
    expect(result.pool).toEqual(
      createPoolRecordFixture({
        liquidityUsd: null,
        volume24hUsd: null,
        transactions24h: null,
        poolCreatedAt: null,
      }),
    );
    expect(result.freshness).toBe("Unknown");
    expect(sideEffects.captureSnapshot).toHaveBeenCalledTimes(1);
    expect(sideEffects.logCaptureFailure).not.toHaveBeenCalled();
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

  it("shapes sparse history when rails read succeeds without any ready card", async () => {
    const sideEffects = createSideEffects({
      readHistory: vi.fn().mockResolvedValue(
        createHistoryFixture({
          rows: [
            {
              capturedAt: "2026-04-21T22:00:00.000Z",
              liquidityUsd: 100,
              volume24hUsd: null,
              transactions24h: 1,
            },
            {
              capturedAt: "2026-04-21T23:00:00.000Z",
              liquidityUsd: null,
              volume24hUsd: 20,
              transactions24h: null,
            },
          ],
        }),
      ),
    });

    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      happyFetcher(),
      REFERENCE_NOW,
      sideEffects,
    );

    expect(result.history).toEqual({
      state: "sparse",
      cards: [
        {
          label: "Liquidity",
          state: "sparse",
          latestValue: 100,
          delta: 0,
          points: [{ timestamp: "2026-04-21T22:00:00.000Z", value: 100 }],
        },
        {
          label: "24h Vol",
          state: "sparse",
          latestValue: 20,
          delta: 0,
          points: [{ timestamp: "2026-04-21T23:00:00.000Z", value: 20 }],
        },
        {
          label: "24h Txs",
          state: "sparse",
          latestValue: 1,
          delta: 0,
          points: [{ timestamp: "2026-04-21T22:00:00.000Z", value: 1 }],
        },
      ],
    });
  });

  it("returns unavailable history when rails history read fails without changing live pool behavior", async () => {
    const sideEffects = createSideEffects({
      readHistory: vi.fn().mockRejectedValue(new UpstreamError("timeout", 504, "rails")),
    });

    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      happyFetcher(),
      REFERENCE_NOW,
      sideEffects,
    );

    expect(result.pool).toEqual(createPoolRecordFixture());
    expect(result.dataState).toEqual({
      status: "complete",
      errors: [],
    });
    expect(result.history.state).toBe("unavailable");
    expect(result.history.cards).toEqual([
      {
        label: "Liquidity",
        state: "sparse",
        latestValue: null,
        delta: null,
        points: [],
      },
      {
        label: "24h Vol",
        state: "sparse",
        latestValue: null,
        delta: null,
        points: [],
      },
      {
        label: "24h Txs",
        state: "sparse",
        latestValue: null,
        delta: null,
        points: [],
      },
    ]);
  });

  it("returns unavailable history when injected reader returns an unusable payload", async () => {
    const sideEffects = createSideEffects({
      readHistory: vi.fn().mockResolvedValue({ rows: null } as unknown as PoolSnapshotHistory),
    });

    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      happyFetcher(),
      REFERENCE_NOW,
      sideEffects,
    );

    expect(result.history.state).toBe("unavailable");
  });

  it("does not attempt rails history read when live pool fetch degrades to a stub", async () => {
    const sideEffects = createSideEffects();

    const result = await getPoolDetailPageData(
      "eth",
      "0xabc",
      undefined,
      rateLimitedFetcher(),
      REFERENCE_NOW,
      sideEffects,
    );

    expect(result.dataState.status).toBe("upstream_error");
    expect(result.history.state).toBe("unavailable");
    expect(sideEffects.readHistory).not.toHaveBeenCalled();
  });
});
