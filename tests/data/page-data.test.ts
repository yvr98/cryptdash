// =============================================================================
// TokenScope — Page Data Test
// =============================================================================
//
// Tests the server-side token detail page model that powers /token/[coinId].
// Updated for 5 supported chains (Ethereum, Base, Arbitrum, Polygon, BNB Chain).
// =============================================================================

import { describe, expect, it } from "vitest";

import { getTokenDetailPageData } from "@/lib/page-data/token-detail";

import { buildTokenMetadata } from "@/lib/page-data/metadata";

function createCoinDetailFixture(
  platforms: Record<string, string>,
  coinId: string = "test-token"
) {
  return {
    token: {
      coinId,
      name: "Ethereum",
      symbol: "eth",
      marketCapRank: 1,
    },
    platforms,
  };
}

/** Mock pool fetcher that returns empty results without network calls. */
async function noOpPoolFetcher() {
  return [];
}

describe("getTokenDetailPageData", () => {
  it("builds a unified supported-chain model across all 5 chains", async () => {
    const pageData = await getTokenDetailPageData("test-token", async () =>
        createCoinDetailFixture({
          ethereum: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          base: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "arbitrum-one": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "polygon-pos": "0x9999999999999999999999999999999999999999",
          "binance-smart-chain": "0x5555555555555555555555555555555555555555",
        }),
      noOpPoolFetcher
    );

    expect(pageData.supportedChains).toHaveLength(5);
    expect(pageData.supportedChains.map((chain) => chain.name)).toEqual([
      "Ethereum",
      "Base",
      "Arbitrum",
      "Polygon",
      "BNB Chain",
    ]);
    expect(pageData.availableSupportedChains).toHaveLength(5);
    expect(pageData.externalLinks.map((link) => link.label)).toEqual([
      "CoinGecko",
      "GeckoTerminal · Ethereum",
      "GeckoTerminal · Base",
      "GeckoTerminal · Arbitrum",
      "GeckoTerminal · Polygon",
      "GeckoTerminal · BNB Chain",
    ]);
    expect(pageData.fallback).toBeNull();
  });

  it("preserves the unified layout when only one chain is mapped", async () => {
    const pageData = await getTokenDetailPageData("test-token", async () =>
        createCoinDetailFixture({
          base: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        }),
      noOpPoolFetcher
    );

    expect(pageData.supportedChains).toHaveLength(5);
    // First chain (Ethereum) should not be available
    expect(pageData.supportedChains[0]?.name).toBe("Ethereum");
    expect(pageData.supportedChains[0]?.isAvailable).toBe(false);
    // Second chain (Base) should be available
    expect(pageData.supportedChains[1]?.name).toBe("Base");
    expect(pageData.supportedChains[1]?.isAvailable).toBe(true);
    expect(pageData.availableSupportedChains.map((chain) => chain.name)).toEqual([
      "Base",
    ]);
    expect(pageData.fallback).toBeNull();
  });

  it("uses deterministic ETH contract overrides when CoinGecko platforms are blank", async () => {
    const pageData = await getTokenDetailPageData(
      "ethereum",
      async () =>
        createCoinDetailFixture({
          "": "",
        }, "ethereum"),
      noOpPoolFetcher
    );

    // ETH overrides cover all 5 chains
    expect(pageData.availableSupportedChains).toHaveLength(5);
    expect(pageData.supportedChains.map((chain) => chain.contractAddress)).toEqual([
      "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2",
      "0x4200000000000000000000000000000000000006",
      "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
      "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
    ]);
    expect(pageData.fallback).toBeNull();
  });

  it("returns safe fallback when no supported-chain mapping exists", async () => {
    const pageData = await getTokenDetailPageData("test-token", async () =>
        createCoinDetailFixture({
          // No supported platform matches
          "solana": "SomeAddress123",
        }),
      noOpPoolFetcher
    );

    expect(pageData.supportedChains).toHaveLength(5);
    expect(pageData.supportedChains.every((chain) => chain.isAvailable === false)).toBe(true);
    expect(pageData.availableSupportedChains).toHaveLength(0);
    expect(pageData.fallback).toEqual({
      title: "No supported chain mappings",
      description:
        "This token was found on CoinGecko but doesn't have a contract mapping on any of the currently supported chains.",
    });
    expect(pageData.externalLinks).toEqual([
      {
        label: "CoinGecko",
        href: "https://www.coingecko.com/en/coins/test-token",
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Token route metadata contract
// ---------------------------------------------------------------------------

describe("buildTokenMetadata", () => {
  it("produces bounded metadata with title, description, openGraph, twitter, and canonical", () => {
    const meta = buildTokenMetadata({
      coinId: "ethereum",
      name: "Ethereum",
      symbol: "eth",
    });

    expect(meta.title).toBe("Ethereum (ETH) — TokenScope");
    expect(meta.description).toContain("Ethereum");
    expect(meta.openGraph?.title).toBe(meta.title);
    expect(meta.openGraph?.description).toBe(meta.description);
    expect((meta.twitter as { card: string }).card).toBe("summary");
    expect(meta.alternates?.canonical).toContain("/token/ethereum");
  });

  it("falls back to coinId when name matches coinId", () => {
    const meta = buildTokenMetadata({
      coinId: "wrapped-bitcoin",
      name: "wrapped-bitcoin",
      symbol: "wbtc",
    });

    expect(meta.title).toContain("wrapped-bitcoin");
    expect(meta.title).toContain("WBTC");
    expect(meta.alternates?.canonical).toContain("/token/wrapped-bitcoin");
  });

  it("omits symbol suffix when symbol is empty", () => {
    const meta = buildTokenMetadata({
      coinId: "test-token",
      name: "Test Token",
      symbol: "",
    });

    expect(meta.title).toBe("Test Token — TokenScope");
    expect(meta.title).not.toContain("()");
  });

  it("canonical URL never includes query params", () => {
    const meta = buildTokenMetadata({
      coinId: "ethereum",
      name: "Ethereum",
      symbol: "eth",
    });

    const canonical = meta.alternates?.canonical as string;
    expect(canonical).not.toContain("?");
    expect(canonical).toMatch(/\/token\/ethereum$/);
  });

  it("metadata keys are bounded to the contract: title/description/og/twitter/canonical only", () => {
    const meta = buildTokenMetadata({
      coinId: "ethereum",
      name: "Ethereum",
      symbol: "eth",
    });

    const topKeys = Object.keys(meta).filter((k) => k !== "openGraph" && k !== "twitter" && k !== "alternates");
    expect(topKeys).toEqual(["title", "description"]);
    expect(Object.keys(meta.openGraph as object)).toEqual(["title", "description"]);
    expect(Object.keys(meta.twitter as object)).toEqual(["card"]);
  });
});
