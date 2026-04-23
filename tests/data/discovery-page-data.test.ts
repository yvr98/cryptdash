// =============================================================================
// CryptDash — Discovery Page Data Tests
// =============================================================================
//
// Tests the discovery shaping helpers in lib/page-data/discovery.ts:
// - Order preservation among retained rows
// - Supported-chain filtering (chainId null → excluded)
// - Page scanning / 20-row cap behavior
// - Empty supported-result behavior
// - Freshness bucket mapping
// - Deduplication by {network}:{address}
// =============================================================================

import { describe, expect, it } from "vitest";

import type { TrendingPoolRow } from "@/lib/types";
import {
  classifyFreshness,
  getDiscoveryPageData,
  MAX_DISCOVERY_PAGES,
  MAX_DISCOVERY_ROWS,
  shapeDiscoveryRows,
} from "@/lib/page-data/discovery";
import { UpstreamError } from "@/lib/api/upstream-error";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Fixed reference time: 2025-01-15T12:00:00Z = 1736932800000 */
const REFERENCE_NOW = 1_736_932_800_000;

function makeRow(overrides: Partial<TrendingPoolRow> & { poolAddress: string }): TrendingPoolRow {
  return {
    pairLabel: "TKN / USDC",
    networkId: "eth",
    chainId: 1,
    dexName: "uniswap_v3",
    liquidityUsd: 100_000,
    volume24hUsd: 50_000,
    transactions24h: 200,
    poolCreatedAt: "2025-01-14T12:00:00Z",
    ...overrides,
  };
}

/** Pool created 12 hours before REFERENCE_NOW → New */
const ROW_NEW = makeRow({ poolAddress: "0xnew", poolCreatedAt: "2025-01-15T00:00:00Z" });

/** Pool created 3 days before REFERENCE_NOW → Recent */
const ROW_RECENT = makeRow({ poolAddress: "0xrecent", poolCreatedAt: "2025-01-12T12:00:00Z" });

/** Pool created 30 days before REFERENCE_NOW → Established */
const ROW_ESTABLISHED = makeRow({
  poolAddress: "0xestablished",
  poolCreatedAt: "2024-12-16T12:00:00Z",
});

/** Pool with no creation timestamp → Unknown */
const ROW_UNKNOWN = makeRow({ poolAddress: "0xunknown", poolCreatedAt: null });


/** Pool on unsupported chain (chainId is null) */
const ROW_UNSUPPORTED: TrendingPoolRow = {
  poolAddress: "0xunsupported",
  pairLabel: "SOL / USDC",
  networkId: "solana",
  chainId: null,
  dexName: "raydium",
  liquidityUsd: 500_000,
  volume24hUsd: 200_000,
  transactions24h: 1000,
  poolCreatedAt: "2025-01-14T12:00:00Z",
};

// ---------------------------------------------------------------------------
// Freshness bucket tests
// ---------------------------------------------------------------------------

describe("classifyFreshness", () => {
  it("maps null timestamp to Unknown", () => {
    expect(classifyFreshness(null, REFERENCE_NOW)).toBe("Unknown");
  });

  it("maps invalid timestamp to Unknown", () => {
    expect(classifyFreshness("not-a-date", REFERENCE_NOW)).toBe("Unknown");
  });

  it("maps future timestamp to Unknown", () => {
    const future = new Date(REFERENCE_NOW + 100_000).toISOString();
    expect(classifyFreshness(future, REFERENCE_NOW)).toBe("Unknown");
  });

  it("maps <24h old pool to New", () => {
    // 12 hours ago
    const created = new Date(REFERENCE_NOW - 12 * 3_600_000).toISOString();
    expect(classifyFreshness(created, REFERENCE_NOW)).toBe("New");
  });

  it("maps exactly 23h59m old pool to New", () => {
    const ms = 23 * 3_600_000 + 59 * 60_000;
    const created = new Date(REFERENCE_NOW - ms).toISOString();
    expect(classifyFreshness(created, REFERENCE_NOW)).toBe("New");
  });

  it("maps 1 day old pool to Recent", () => {
    // Exactly 24 hours + 1 second
    const created = new Date(REFERENCE_NOW - 24 * 3_600_000 - 1000).toISOString();
    expect(classifyFreshness(created, REFERENCE_NOW)).toBe("Recent");
  });

  it("maps 6 days old pool to Recent", () => {
    const created = new Date(REFERENCE_NOW - 6 * 24 * 3_600_000).toISOString();
    expect(classifyFreshness(created, REFERENCE_NOW)).toBe("Recent");
  });

  it("maps exactly 7 days old pool to Established", () => {
    const created = new Date(REFERENCE_NOW - 7 * 24 * 3_600_000).toISOString();
    expect(classifyFreshness(created, REFERENCE_NOW)).toBe("Established");
  });

  it("maps 30 days old pool to Established", () => {
    const created = new Date(REFERENCE_NOW - 30 * 24 * 3_600_000).toISOString();
    expect(classifyFreshness(created, REFERENCE_NOW)).toBe("Established");
  });
});

// ---------------------------------------------------------------------------
// Supported-chain filtering
// ---------------------------------------------------------------------------

describe("shapeDiscoveryRows — supported-chain filtering", () => {
  it("excludes rows where chainId is null", () => {
    const result = shapeDiscoveryRows([[ROW_UNSUPPORTED]], REFERENCE_NOW);

    expect(result.rows).toHaveLength(0);
    expect(result.totalSupported).toBe(0);
  });

  it("retains only rows with supported chainId", () => {
    const rows: TrendingPoolRow[] = [
      ROW_NEW,
      ROW_UNSUPPORTED,
      ROW_RECENT,
    ];

    const result = shapeDiscoveryRows([rows], REFERENCE_NOW);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!.poolAddress).toBe("0xnew");
    expect(result.rows[1]!.poolAddress).toBe("0xrecent");
  });

  it("retains all 5 supported chains", () => {
    const rows: TrendingPoolRow[] = [
      makeRow({ poolAddress: "0x1", chainId: 1 }),
      makeRow({ poolAddress: "0x2", chainId: 8453 }),
      makeRow({ poolAddress: "0x3", chainId: 42161 }),
      makeRow({ poolAddress: "0x4", chainId: 137 }),
      makeRow({ poolAddress: "0x5", chainId: 56 }),
    ];

    const result = shapeDiscoveryRows([rows], REFERENCE_NOW);

    expect(result.rows).toHaveLength(5);
    expect(result.rows.map((r) => r.chainId)).toEqual([1, 8453, 42161, 137, 56]);
  });
});

// ---------------------------------------------------------------------------
// Order preservation
// ---------------------------------------------------------------------------

describe("shapeDiscoveryRows — order preservation", () => {
  it("preserves upstream order among retained rows", () => {
    const rows: TrendingPoolRow[] = [
      makeRow({ poolAddress: "0xthird", chainId: 56 }),
      makeRow({ poolAddress: "0xunsupported", chainId: null }),
      makeRow({ poolAddress: "0xfirst", chainId: 1 }),
      makeRow({ poolAddress: "0xsecond", chainId: 8453 }),
    ];

    const result = shapeDiscoveryRows([rows], REFERENCE_NOW);

    expect(result.rows.map((r) => r.poolAddress)).toEqual([
      "0xthird",
      "0xfirst",
      "0xsecond",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe("shapeDiscoveryRows — deduplication", () => {
  it("dedupes by {networkId}:{poolAddress}, keeping first occurrence", () => {
    const rows: TrendingPoolRow[] = [
      makeRow({ poolAddress: "0xdup", networkId: "eth", chainId: 1 }),
      makeRow({ poolAddress: "0xdup", networkId: "eth", chainId: 1 }),
      makeRow({ poolAddress: "0xunique", networkId: "eth", chainId: 1 }),
    ];

    const result = shapeDiscoveryRows([rows], REFERENCE_NOW);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!.poolAddress).toBe("0xdup");
    expect(result.rows[1]!.poolAddress).toBe("0xunique");
  });

  it("treats same address on different networks as distinct", () => {
    const rows: TrendingPoolRow[] = [
      makeRow({ poolAddress: "0xsame", networkId: "eth", chainId: 1 }),
      makeRow({ poolAddress: "0xsame", networkId: "base", chainId: 8453 }),
    ];

    const result = shapeDiscoveryRows([rows], REFERENCE_NOW);

    expect(result.rows).toHaveLength(2);
  });

  it("deduplication is case-insensitive", () => {
    const rows: TrendingPoolRow[] = [
      makeRow({ poolAddress: "0xABC", networkId: "eth", chainId: 1 }),
      makeRow({ poolAddress: "0xabc", networkId: "ETH", chainId: 1 }),
    ];

    const result = shapeDiscoveryRows([rows], REFERENCE_NOW);

    expect(result.rows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Page scanning and cap behavior
// ---------------------------------------------------------------------------

describe("shapeDiscoveryRows — page scanning and cap", () => {
  it("scans up to 3 pages sequentially", () => {
    const page1 = [makeRow({ poolAddress: "0xp1" })];
    const page2 = [makeRow({ poolAddress: "0xp2" })];
    const page3 = [makeRow({ poolAddress: "0xp3" })];
    const page4 = [makeRow({ poolAddress: "0xp4" })];

    const result = shapeDiscoveryRows([page1, page2, page3, page4], REFERENCE_NOW);

    expect(result.pagesScanned).toBe(3);
    expect(result.totalSupported).toBe(3);
    expect(result.rows).toHaveLength(3);
  });

  it("stops scanning after collecting 20 rows and sets capped=true", () => {
    const page1: TrendingPoolRow[] = Array.from({ length: 15 }, (_, i) =>
      makeRow({ poolAddress: `0xp1-${i}` })
    );
    const page2: TrendingPoolRow[] = Array.from({ length: 10 }, (_, i) =>
      makeRow({ poolAddress: `0xp2-${i}` })
    );
    const page3: TrendingPoolRow[] = Array.from({ length: 5 }, (_, i) =>
      makeRow({ poolAddress: `0xp3-${i}` })
    );

    const result = shapeDiscoveryRows([page1, page2, page3], REFERENCE_NOW);

    expect(result.rows).toHaveLength(MAX_DISCOVERY_ROWS);
    expect(result.capped).toBe(true);
    // Page 1 gives 15, page 2 gives 5 before cap → pagesScanned should be 2
    expect(result.pagesScanned).toBe(2);
    // totalSupported counts all unique supported rows found up to cap point
    expect(result.totalSupported).toBeGreaterThanOrEqual(MAX_DISCOVERY_ROWS);
  });

  it("returns capped=false when rows are fewer than 20", () => {
    const rows = [ROW_NEW, ROW_RECENT];

    const result = shapeDiscoveryRows([rows], REFERENCE_NOW);

    expect(result.rows).toHaveLength(2);
    expect(result.capped).toBe(false);
    expect(result.totalSupported).toBe(2);
  });

  it("handles exact 20 rows without capping past page boundary", () => {
    const page1 = Array.from({ length: 20 }, (_, i) =>
      makeRow({ poolAddress: `0xexact-${i}` })
    );

    const result = shapeDiscoveryRows([page1], REFERENCE_NOW);

    expect(result.rows).toHaveLength(20);
    // 20 is exactly the cap, so capped should be true since rows.length >= MAX
    expect(result.capped).toBe(true);
    expect(result.pagesScanned).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Empty supported-result behavior
// ---------------------------------------------------------------------------

describe("shapeDiscoveryRows — empty results", () => {
  it("returns stable empty model with emptyState when all rows are unsupported", () => {
    const result = shapeDiscoveryRows(
      [[ROW_UNSUPPORTED, { ...ROW_UNSUPPORTED, poolAddress: "0xsol2" }]],
      REFERENCE_NOW
    );

    expect(result.rows).toEqual([]);
    expect(result.totalSupported).toBe(0);
    expect(result.pagesScanned).toBe(1);
    expect(result.capped).toBe(false);
    expect(result.referenceTime).toBe(REFERENCE_NOW);
    expect(result.emptyState).toEqual({
      reason: "no_supported_rows",
      hadUnsupportedRows: true,
    });
  });

  it("returns emptyState with hadUnsupportedRows=false for empty page arrays", () => {
    const result = shapeDiscoveryRows([[]], REFERENCE_NOW);

    expect(result.rows).toEqual([]);
    expect(result.totalSupported).toBe(0);
    expect(result.pagesScanned).toBe(1);
    expect(result.capped).toBe(false);
    expect(result.emptyState).toEqual({
      reason: "no_supported_rows",
      hadUnsupportedRows: false,
    });
  });

  it("returns no_input emptyState for no pages", () => {
    const result = shapeDiscoveryRows([], REFERENCE_NOW);

    expect(result.rows).toEqual([]);
    expect(result.totalSupported).toBe(0);
    expect(result.pagesScanned).toBe(0);
    expect(result.capped).toBe(false);
    expect(result.emptyState).toEqual({
      reason: "no_input",
      hadUnsupportedRows: false,
    });
  });
});

// ---------------------------------------------------------------------------
// Non-empty emptyState contract
// ---------------------------------------------------------------------------

describe("shapeDiscoveryRows — emptyState is null when rows exist", () => {
  it("returns emptyState=null when rows are present", () => {
    const result = shapeDiscoveryRows([[ROW_NEW]], REFERENCE_NOW);

    expect(result.rows).toHaveLength(1);
    expect(result.emptyState).toBeNull();
  });

  it("returns emptyState=null even with mixed supported/unsupported rows", () => {
    const result = shapeDiscoveryRows(
      [[ROW_UNSUPPORTED, ROW_NEW]],
      REFERENCE_NOW
    );

    expect(result.rows).toHaveLength(1);
    expect(result.emptyState).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Freshness mapping integration
// ---------------------------------------------------------------------------

describe("shapeDiscoveryRows — freshness mapping", () => {
  it("assigns correct freshness buckets to shaped rows", () => {
    const rows: TrendingPoolRow[] = [ROW_NEW, ROW_RECENT, ROW_ESTABLISHED, ROW_UNKNOWN];

    const result = shapeDiscoveryRows([rows], REFERENCE_NOW);

    expect(result.rows).toHaveLength(4);
    expect(result.rows[0]!.freshness).toBe("New");
    expect(result.rows[1]!.freshness).toBe("Recent");
    expect(result.rows[2]!.freshness).toBe("Established");
    expect(result.rows[3]!.freshness).toBe("Unknown");
  });

  it("carries poolCreatedAt through to DiscoveryRow", () => {
    const result = shapeDiscoveryRows([[ROW_NEW]], REFERENCE_NOW);

    expect(result.rows[0]!.poolCreatedAt).toBe(ROW_NEW.poolCreatedAt);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("MAX_DISCOVERY_ROWS is 20", () => {
    expect(MAX_DISCOVERY_ROWS).toBe(20);
  });

  it("MAX_DISCOVERY_PAGES is 3", () => {
    expect(MAX_DISCOVERY_PAGES).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getDiscoveryPageData — async page-data assembly
// ---------------------------------------------------------------------------


// Helper to create a mock fetcher that returns specific pages
function mockFetcher(pageResponses: Map<number, TrendingPoolRow[] | Error>) {
  return async (page: number): Promise<TrendingPoolRow[]> => {
    const result = pageResponses.get(page);
    if (!result) return [];
    if (result instanceof Error) throw result;
    return result;
  };
}



describe("getDiscoveryPageData — basic assembly", () => {
  it("fetches page 1 and returns a complete dataState", async () => {
    const rows = [makeRow({ poolAddress: "0xabc" })];
    const fetcher = mockFetcher(new Map([[1, rows]]));

    const result = await getDiscoveryPageData(fetcher, REFERENCE_NOW);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.poolAddress).toBe("0xabc");
    expect(result.dataState.status).toBe("complete");
    expect(result.dataState.errors).toEqual([]);
    expect(result.emptyState).toBeNull();
    expect(result.copy.title).toBe("Explore trending pools across supported chains");
    expect(result.copy.description).toContain("upstream-ranked");
  });

  it("fetches pages 1-3 sequentially when rows < 20", async () => {
    const pages = new Map([
      [1, [makeRow({ poolAddress: "0xp1" })]],
      [2, [makeRow({ poolAddress: "0xp2" })]],
      [3, [makeRow({ poolAddress: "0xp3" })]],
    ]);
    const fetcher = mockFetcher(pages);

    const result = await getDiscoveryPageData(fetcher, REFERENCE_NOW);

    expect(result.rows).toHaveLength(3);
    expect(result.pagesScanned).toBe(3);
    expect(result.dataState.status).toBe("complete");
    expect(result.copy.title).toBe("Explore trending pools across supported chains");
  });

  it("stops fetching once 20 rows are collected", async () => {
    const page1 = Array.from({ length: 15 }, (_, i) =>
      makeRow({ poolAddress: `0xp1-${i}` })
    );
    const page2 = Array.from({ length: 10 }, (_, i) =>
      makeRow({ poolAddress: `0xp2-${i}` })
    );
    let fetchCount = 0;
    const fetcher = async (page: number) => {
      fetchCount++;
      if (page === 1) return page1;
      if (page === 2) return page2;
      return [];
    };

    const result = await getDiscoveryPageData(fetcher, REFERENCE_NOW);

    expect(result.rows).toHaveLength(20);
    expect(result.capped).toBe(true);
    expect(fetchCount).toBe(2); // Did not fetch page 3
    expect(result.copy.title).toBe("Explore trending pools across supported chains");
  });

  it("returns empty model with no_input when all pages are empty", async () => {
    const fetcher = mockFetcher(new Map([
      [1, []],
      [2, []],
      [3, []],
    ]));

    const result = await getDiscoveryPageData(fetcher, REFERENCE_NOW);

    expect(result.rows).toEqual([]);
    expect(result.emptyState).toEqual({
      reason: "no_supported_rows",
      hadUnsupportedRows: false,
    });
    expect(result.dataState.status).toBe("complete");
    expect(result.copy.description).toContain("empty snapshot");
  });
});

describe("getDiscoveryPageData — upstream error handling", () => {
  it("catches rate-limit error and returns upstream_error dataState", async () => {
    const rateLimitError = new UpstreamError("rate_limited", 429, "geckoterminal");
    const fetcher = mockFetcher(new Map([[1, rateLimitError]]));

    const result = await getDiscoveryPageData(fetcher, REFERENCE_NOW);

    expect(result.dataState.status).toBe("upstream_error");
    expect(result.dataState.errors).toHaveLength(1);
    expect(result.dataState.errors[0]!.category).toBe("rate_limited");
    expect(result.dataState.errors[0]!.source).toBe("geckoterminal");
    expect(result.copy.title).toBe("Discovery data unavailable");
  });

  it("catches server error and returns upstream_error dataState", async () => {
    const serverError = new UpstreamError("server_error", 500, "geckoterminal");
    const fetcher = mockFetcher(new Map([[1, serverError]]));

    const result = await getDiscoveryPageData(fetcher, REFERENCE_NOW);

    expect(result.dataState.status).toBe("upstream_error");
    expect(result.dataState.errors).toHaveLength(1);
    expect(result.dataState.errors[0]!.category).toBe("server_error");
    expect(result.copy.title).toBe("Discovery data unavailable");
  });

  it("stops fetching further pages after upstream failure", async () => {
    const serverError = new UpstreamError("server_error", 500, "geckoterminal");
    let fetchCount = 0;
    const fetcher = async (page: number) => {
      fetchCount++;
      if (page === 2) throw serverError;
      return [makeRow({ poolAddress: `0xpage${page}` })];
    };

    const result = await getDiscoveryPageData(fetcher, REFERENCE_NOW);

    expect(result.dataState.status).toBe("upstream_error");
    expect(result.dataState.errors).toHaveLength(1);
    expect(fetchCount).toBe(2); // Stopped after page 2 failure
    // Still has rows from page 1
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.poolAddress).toBe("0xpage1");
    expect(result.copy.title).toBe("Discovery data partially unavailable");
    expect(result.copy.description).toContain("available data only");
  });

  it("catches non-UpstreamError throws as server_error", async () => {
    const fetcher = async () => {
      throw new Error("something unexpected");
    };

    const result = await getDiscoveryPageData(fetcher, REFERENCE_NOW);

    expect(result.dataState.status).toBe("upstream_error");
    expect(result.dataState.errors).toHaveLength(1);
    expect(result.dataState.errors[0]!.category).toBe("server_error");
    expect(result.dataState.errors[0]!.source).toBe("unknown");
    expect(result.dataState.errors[0]!.userMessage).toContain("unexpected error");
    expect(result.copy.title).toBe("Discovery data unavailable");
  });

  it("returns empty rows but does not throw when page 1 fails", async () => {
    const rateLimitError = new UpstreamError("rate_limited", 429, "geckoterminal");
    const fetcher = mockFetcher(new Map([[1, rateLimitError]]));

    const result = await getDiscoveryPageData(fetcher, REFERENCE_NOW);

    expect(result.rows).toEqual([]);
    expect(result.totalSupported).toBe(0);
    expect(result.emptyState).toEqual({
      reason: "no_input",
      hadUnsupportedRows: false,
    });
    expect(result.copy.title).toBe("Discovery data unavailable");
    expect(result.copy.description).toContain("could not be loaded");
  });

  it("retains rows from successful pages before failure", async () => {
    const serverError = new UpstreamError("server_error", 503, "geckoterminal");
    const page1Rows = [makeRow({ poolAddress: "0xbefore1" }), makeRow({ poolAddress: "0xbefore2" })];
    const fetcher = mockFetcher(new Map<number, TrendingPoolRow[] | Error>([
      [1, page1Rows],
      [2, serverError],
    ]));

    const result = await getDiscoveryPageData(fetcher, REFERENCE_NOW);

    expect(result.rows).toHaveLength(2);
    expect(result.dataState.status).toBe("upstream_error");
    expect(result.emptyState).toBeNull(); // rows exist, so no emptyState
    expect(result.copy.title).toBe("Discovery data partially unavailable");
    expect(result.copy.description).toContain("available data only");
  });
});

describe("getDiscoveryPageData — explanatory copy contract", () => {
  it("returns upstream-ranked copy for complete results with rows", async () => {
    const fetcher = mockFetcher(new Map([[1, [makeRow({ poolAddress: "0x1" })]]]));

    const result = await getDiscoveryPageData(fetcher, REFERENCE_NOW);

    expect(result.copy).toEqual({
      title: "Explore trending pools across supported chains",
      description:
        "Discovery order is upstream-ranked. CryptDash keeps the original feed order, filters it to supported chains, and shows the latest available liquidity, volume, activity, and freshness signals.",
    });
  });

  it("returns no-input copy when page 1 fails with no rows collected", async () => {
    const err = new UpstreamError("rate_limited", 429, "geckoterminal");
    const fetcher = mockFetcher(new Map([[1, err]]));

    const result = await getDiscoveryPageData(fetcher, REFERENCE_NOW);

    expect(result.copy.title).toBe("Discovery data unavailable");
    expect(result.copy.description).toContain("could not be loaded");
    expect(result.copy.description).toContain("Try refreshing");
  });

  it("returns no-supported-rows copy when all upstream rows are unsupported", async () => {
    const unsupportedRow: TrendingPoolRow = {
      poolAddress: "0xsol",
      pairLabel: "SOL / USDC",
      networkId: "solana",
      chainId: null,
      dexName: "raydium",
      liquidityUsd: 500_000,
      volume24hUsd: 200_000,
      transactions24h: 1000,
      poolCreatedAt: "2025-01-14T12:00:00Z",
    };
    const fetcher = mockFetcher(new Map([[1, [unsupportedRow]]]));

    const result = await getDiscoveryPageData(fetcher, REFERENCE_NOW);

    expect(result.rows).toEqual([]);
    expect(result.copy.title).toBe("No supported-chain pools in this snapshot");
    expect(result.copy.description).toContain("none mapped to CryptDash's supported chains");
  });

  it("returns partially-unavailable copy when rows exist but upstream errored", async () => {
    const err = new UpstreamError("server_error", 500, "geckoterminal");
    const rows = [makeRow({ poolAddress: "0xok" })];
    const fetcher = mockFetcher(new Map<number, TrendingPoolRow[] | Error>([[1, rows], [2, err]]));

    const result = await getDiscoveryPageData(fetcher, REFERENCE_NOW);

    expect(result.copy.title).toBe("Discovery data partially unavailable");
    expect(result.copy.description).toContain("available data only");
    expect(result.copy.description).toContain("Try refreshing");
  });
});
