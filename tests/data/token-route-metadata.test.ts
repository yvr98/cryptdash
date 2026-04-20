// =============================================================================
// TokenScope — Token Route Metadata Test
// =============================================================================
//
// Tests the bounded metadata contract for /token/[coinId]:
// - buildTokenMetadata produces stable title/description/og/twitter/canonical
// - buildTokenPath constructs correct canonical paths
// - Route-level generateMetadata handles degraded and error states
// =============================================================================

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  TOKEN_ROUTE_SEGMENT,
  buildTokenPath,
} from "@/lib/constants/route";
import { buildTokenMetadata } from "@/lib/page-data/metadata";

// ---------------------------------------------------------------------------
// Token route path construction
// ---------------------------------------------------------------------------

describe("buildTokenPath", () => {
  it("builds a canonical token path from coinId", () => {
    const path = buildTokenPath("ethereum");
    expect(path).toBe("/token/ethereum");
  });

  it("uses the TOKEN_ROUTE_SEGMENT constant as the base", () => {
    expect(TOKEN_ROUTE_SEGMENT).toBe("/token");
    const path = buildTokenPath("wrapped-bitcoin");
    expect(path.startsWith(TOKEN_ROUTE_SEGMENT)).toBe(true);
  });

  it("preserves the coinId as-is (no encoding)", () => {
    const path = buildTokenPath("some-token");
    expect(path).toBe("/token/some-token");
  });
});

// ---------------------------------------------------------------------------
// Token route metadata contract
// ---------------------------------------------------------------------------

describe("buildTokenMetadata", () => {
  it("produces bounded metadata with token name and symbol", () => {
    const meta = buildTokenMetadata({
      coinId: "ethereum",
      name: "Ethereum",
      symbol: "eth",
    });

    expect(meta.title).toContain("Ethereum");
    expect(meta.title).toContain("(ETH)");
    expect(meta.description).toContain("Ethereum");
    expect(meta.openGraph?.title).toBe(meta.title);
    expect(meta.openGraph?.description).toBe(meta.description);
    expect((meta.twitter as { card: string }).card).toBe("summary");
  });

  it("canonical URL uses token path", () => {
    const meta = buildTokenMetadata({
      coinId: "ethereum",
      name: "Ethereum",
      symbol: "eth",
    });

    const canonical = meta.alternates?.canonical as string;
    expect(canonical).toContain("/token/ethereum");
  });

  it("falls back to coinId when name matches coinId", () => {
    const meta = buildTokenMetadata({
      coinId: "test-token",
      name: "test-token",
      symbol: "",
    });

    // name === coinId triggers the fallback displayName path
    expect(meta.title).toContain("test-token");
    expect(meta.description).toContain("test-token");
  });

  it("falls back to coinId when name is empty", () => {
    const meta = buildTokenMetadata({
      coinId: "unknown-coin",
      name: "",
      symbol: "",
    });

    expect(meta.title).toContain("unknown-coin");
    expect(meta.description).toContain("unknown-coin");
  });

  it("omits symbol suffix when symbol is empty", () => {
    const meta = buildTokenMetadata({
      coinId: "ethereum",
      name: "Ethereum",
      symbol: "",
    });

    expect(meta.title).not.toContain("(");
  });

  it("uppercases symbol in title", () => {
    const meta = buildTokenMetadata({
      coinId: "bitcoin",
      name: "Bitcoin",
      symbol: "btc",
    });

    expect(meta.title).toContain("(BTC)");
  });

  it("metadata keys are bounded to the contract: title/description/og/twitter/canonical only", () => {
    const meta = buildTokenMetadata({
      coinId: "ethereum",
      name: "Ethereum",
      symbol: "eth",
    });

    const topKeys = Object.keys(meta).filter(
      (k) => k !== "openGraph" && k !== "twitter" && k !== "alternates"
    );
    expect(topKeys).toEqual(["title", "description"]);
    expect(Object.keys(meta.openGraph as object)).toEqual([
      "title",
      "description",
    ]);
    expect(Object.keys(meta.twitter as object)).toEqual(["card"]);
  });

  it("produces valid metadata for degraded upstream state", () => {
    // When upstream fails, getTokenDetailPageData returns:
    // { coinId, name: coinId, symbol: "" }
    const meta = buildTokenMetadata({
      coinId: "some-token",
      name: "some-token",
      symbol: "",
    });

    expect(typeof meta.title).toBe("string");
    expect(String(meta.title).length).toBeGreaterThan(0);
    expect(typeof meta.description).toBe("string");
    expect(String(meta.description).length).toBeGreaterThan(0);
    expect(meta.openGraph?.title).toBeTruthy();
    expect(meta.openGraph?.description).toBeTruthy();
    expect((meta.twitter as { card: string }).card).toBe("summary");
    expect(meta.alternates?.canonical).toBeTruthy();
  });
});
// ---------------------------------------------------------------------------
// Route-level generateMetadata tests
// ---------------------------------------------------------------------------
//
// Mocks the data layer and imports the real route export to prove
// generateMetadata handles happy-path, not-found propagation, and
// degraded-state fallback correctly at the route boundary.
// ---------------------------------------------------------------------------

import { UpstreamError } from "@/lib/api/upstream-error";
import type { TokenDetailPageData } from "@/lib/page-data/token-detail";

const mockGetTokenDetailPageData = vi.fn<
  (coinId: string) => Promise<TokenDetailPageData>
>();

vi.mock("@/lib/page-data/token-detail", () => ({
  getTokenDetailPageData: (...args: [string]) =>
    mockGetTokenDetailPageData(...args),
}));

const mockNotFound = vi.fn(() => {
  const err: Error & { digest: string } = Object.assign(
    new Error("NEXT_NOT_FOUND"),
    { digest: "NEXT_NOT_FOUND" as const },
  );
  throw err;
});

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

// Import after mocks are in place
import { generateMetadata } from "@/app/token/[coinId]/page";

function makeTokenPageData(
  overrides: Partial<TokenDetailPageData["token"]> = {},
): TokenDetailPageData {
  return {
    token: {
      coinId: "ethereum",
      name: "Ethereum",
      symbol: "eth",
      marketCapRank: 1,
      marketData: {
        currentPriceUsd: 3000,
        priceChange24hPercent: 2.5,
        marketCap: 360_000_000_000,
        totalVolume24h: 18_000_000_000,
        circulatingSupply: 120_000_000,
        fullyDilutedValuation: 360_000_000_000,
      },
      ...overrides,
    },
    marketData: {
      currentPriceUsd: 3000,
      priceChange24hPercent: 2.5,
      marketCap: 360_000_000_000,
      totalVolume24h: 18_000_000_000,
      circulatingSupply: 120_000_000,
      fullyDilutedValuation: 360_000_000_000,
    },
    priceContext: { marketCapRank: 1 },
    supportedChains: [],
    availableSupportedChains: [],
    externalLinks: [],
    fallback: null,
    eligiblePools: [],
    recommendation: {
      status: "insufficient_data" as const,
      eligiblePools: [],
      confidence: "low" as const,
      rationale: "No eligible pools found.",
    },
    dataState: { status: "complete" as const, errors: [] },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("token route generateMetadata", () => {
  it("produces bounded metadata from complete token data", async () => {
    mockGetTokenDetailPageData.mockResolvedValue(makeTokenPageData());

    const meta = await generateMetadata({
      params: Promise.resolve({ coinId: "ethereum" }),
    });

    expect(meta.title).toContain("Ethereum");
    expect(meta.title).toContain("(ETH)");
    expect(meta.description).toContain("Ethereum");
    expect(meta.openGraph?.title).toBe(meta.title);
    expect(meta.openGraph?.description).toBe(meta.description);
    expect((meta.twitter as { card: string }).card).toBe("summary");
  });

  it("canonical URL uses token path", async () => {
    mockGetTokenDetailPageData.mockResolvedValue(makeTokenPageData());

    const meta = await generateMetadata({
      params: Promise.resolve({ coinId: "ethereum" }),
    });

    const canonical = meta.alternates?.canonical as string;
    expect(canonical).toContain("/token/ethereum");
  });

  it("propagates notFound() on UpstreamError not_found", async () => {
    mockGetTokenDetailPageData.mockRejectedValue(
      new UpstreamError("not_found", 404, "coingecko"),
    );

    await expect(
      generateMetadata({
        params: Promise.resolve({ coinId: "nonexistent" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it("returns safe fallback metadata on unexpected error", async () => {
    mockGetTokenDetailPageData.mockRejectedValue(
      new UpstreamError("rate_limited", 429, "coingecko"),
    );

    const meta = await generateMetadata({
      params: Promise.resolve({ coinId: "some-token" }),
    });

    // Fallback: uses coinId as name with empty symbol
    expect(meta.title).toContain("some-token");
    expect(typeof meta.title).toBe("string");
    expect(String(meta.title).length).toBeGreaterThan(0);
    expect(meta.openGraph?.title).toBeTruthy();
    expect(meta.alternates?.canonical).toBeTruthy();
  });

  it("calls getTokenDetailPageData with coinId only (no fixture params)", async () => {
    mockGetTokenDetailPageData.mockResolvedValue(makeTokenPageData());

    await generateMetadata({
      params: Promise.resolve({ coinId: "ethereum" }),
    });

    expect(mockGetTokenDetailPageData).toHaveBeenCalledWith("ethereum");
    expect(mockGetTokenDetailPageData).toHaveBeenCalledTimes(1);
  });
});
