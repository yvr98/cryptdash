// =============================================================================
// TokenScope — Pool Route Metadata Integration Tests
// =============================================================================
//
// Tests the route-level generateMetadata function exported from
// /pool/[network]/[poolAddress]/page.tsx.
//
// Verifies:
//   - Metadata is produced from pool data via buildPoolMetadata
//   - Canonical URL never includes coinId query context
//   - Degraded pool data (empty pairLabel/dexName) still yields valid metadata
//   - UpstreamError("not_found") triggers notFound()
// =============================================================================

import { beforeEach, describe, expect, it, vi } from "vitest";

import { UpstreamError } from "@/lib/api/upstream-error";
import type { PoolDetailPageData } from "@/lib/page-data/pool-detail";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetPoolDetailPageData = vi.fn<
  (
    network: string,
    poolAddress: string,
    coinId?: string,
  ) => Promise<PoolDetailPageData>
>();

vi.mock("@/lib/page-data/pool-detail", () => ({
  getPoolDetailPageData: (
    ...args: [string, string, string?]
  ) => mockGetPoolDetailPageData(...args),
}));

const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

// Import after mocks are in place
import { generateMetadata } from "@/app/pool/[network]/[poolAddress]/page";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_ADDRESS = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";

function makePoolPageData(
  overrides: Partial<PoolDetailPageData["pool"]> = {},
): PoolDetailPageData {
  return {
    pool: {
      poolAddress: SAMPLE_ADDRESS,
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
      poolCreatedAt: "2023-01-01T00:00:00Z",
      ...overrides,
    },
    freshness: "Established",
    backlink: null,
    dataState: { status: "complete", errors: [] },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pool route generateMetadata", () => {
  it("produces bounded metadata from complete pool data", async () => {
    mockGetPoolDetailPageData.mockResolvedValue(makePoolPageData());

    const meta = await generateMetadata({
      params: Promise.resolve({ network: "eth", poolAddress: SAMPLE_ADDRESS }),
      searchParams: Promise.resolve({}),
    });

    expect(meta.title).toContain("WETH / USDC");
    expect(meta.title).toContain("Uniswap V3");
    expect(meta.description).toContain("WETH / USDC");
    expect(meta.description).toContain("eth");
    expect(meta.openGraph?.title).toBe(meta.title);
    expect(meta.openGraph?.description).toBe(meta.description);
    expect((meta.twitter as { card: string }).card).toBe("summary");
  });

  it("canonical URL uses pool path without coinId query", async () => {
    mockGetPoolDetailPageData.mockResolvedValue(makePoolPageData());

    const meta = await generateMetadata({
      params: Promise.resolve({ network: "eth", poolAddress: SAMPLE_ADDRESS }),
      searchParams: Promise.resolve({ coinId: "ethereum" }),
    });

    // generateMetadata ignores searchParams — canonical never includes coinId
    const canonical = meta.alternates?.canonical as string;
    expect(canonical).not.toContain("?");
    expect(canonical).not.toContain("coinId");
    expect(canonical).toContain("/pool/eth/");
    expect(canonical).toContain(SAMPLE_ADDRESS);
  });

  it("canonical URL never includes coinId even when coinId is in searchParams", async () => {
    mockGetPoolDetailPageData.mockResolvedValue(makePoolPageData());

    const meta = await generateMetadata({
      params: Promise.resolve({ network: "base", poolAddress: SAMPLE_ADDRESS }),
      searchParams: Promise.resolve({ coinId: "usd-coin" }),
    });

    const canonical = meta.alternates?.canonical as string;
    expect(canonical).toBe(
      `https://tokenscope-rl.vercel.app/pool/base/${SAMPLE_ADDRESS}`,
    );
  });

  it("produces metadata with fallback labels when pool has empty pairLabel", async () => {
    mockGetPoolDetailPageData.mockResolvedValue(
      makePoolPageData({ pairLabel: "", dexName: "" }),
    );

    const meta = await generateMetadata({
      params: Promise.resolve({ network: "eth", poolAddress: SAMPLE_ADDRESS }),
      searchParams: Promise.resolve({}),
    });

    // Should fall back to truncated address
    expect(meta.title).toContain("0x88e6");
    expect(meta.title).toContain("5640");
    expect(meta.description).toBeDefined();
  });

  it("produces metadata when pool has empty dexName", async () => {
    mockGetPoolDetailPageData.mockResolvedValue(
      makePoolPageData({ dexName: "" }),
    );

    const meta = await generateMetadata({
      params: Promise.resolve({ network: "arbitrum", poolAddress: SAMPLE_ADDRESS }),
      searchParams: Promise.resolve({}),
    });

    expect(meta.title).toContain("WETH / USDC");
    expect(meta.title).not.toContain("on ");
  });

  it("calls notFound() on UpstreamError not_found", async () => {
    mockGetPoolDetailPageData.mockRejectedValue(
      new UpstreamError("not_found", 404, "geckoterminal"),
    );

    await expect(
      generateMetadata({
        params: Promise.resolve({ network: "eth", poolAddress: "0xbad" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it("metadata keys are bounded: title/description/og/twitter/canonical only", async () => {
    mockGetPoolDetailPageData.mockResolvedValue(makePoolPageData());

    const meta = await generateMetadata({
      params: Promise.resolve({ network: "eth", poolAddress: SAMPLE_ADDRESS }),
      searchParams: Promise.resolve({}),
    });

    const topKeys = Object.keys(meta).filter(
      (k) => k !== "openGraph" && k !== "twitter" && k !== "alternates",
    );
    expect(topKeys).toEqual(["title", "description"]);
    expect(Object.keys(meta.openGraph as object)).toEqual([
      "title",
      "description",
    ]);
    expect(Object.keys(meta.twitter as object)).toEqual(["card"]);
  });

  it("reuses canonical path format from buildPoolPath", async () => {
    mockGetPoolDetailPageData.mockResolvedValue(makePoolPageData());

    const meta = await generateMetadata({
      params: Promise.resolve({
        network: "polygon_pos",
        poolAddress: SAMPLE_ADDRESS,
      }),
      searchParams: Promise.resolve({}),
    });

    const canonical = meta.alternates?.canonical as string;
    // Canonical must follow /pool/[network]/[poolAddress] — no coinId
    const url = new URL(canonical);
    expect(url.pathname).toBe(`/pool/polygon_pos/${SAMPLE_ADDRESS}`);
    expect(url.search).toBe("");
  });

  it("does not pass coinId to getPoolDetailPageData for metadata", async () => {
    mockGetPoolDetailPageData.mockResolvedValue(makePoolPageData());

    await generateMetadata({
      params: Promise.resolve({ network: "eth", poolAddress: SAMPLE_ADDRESS }),
      searchParams: Promise.resolve({ coinId: "ethereum" }),
    });

    // generateMetadata only awaits params — never forwards coinId to data layer
    expect(mockGetPoolDetailPageData).toHaveBeenCalledWith(
      "eth",
      SAMPLE_ADDRESS,
      undefined,
    );
    expect(mockGetPoolDetailPageData).toHaveBeenCalledTimes(1);
  });
});
