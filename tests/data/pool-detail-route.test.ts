import { describe, expect, it } from "vitest";
import {
  POOL_ROUTE_SEGMENT,
  buildPoolPath,
} from "@/lib/constants/route";
import { buildPoolMetadata } from "@/lib/page-data/metadata";

describe("buildPoolPath", () => {
  // ---------------------------------------------------------------------------
  // Canonical path construction
  // ---------------------------------------------------------------------------

  it("builds a canonical pool path from network and pool address", () => {
    const path = buildPoolPath("eth", "0xabc123");
    expect(path).toBe("/pool/eth/0xabc123");
  });

  it("uses the POOL_ROUTE_SEGMENT constant as the base", () => {
    expect(POOL_ROUTE_SEGMENT).toBe("/pool");
    const path = buildPoolPath("base", "0xdef456");
    expect(path.startsWith(POOL_ROUTE_SEGMENT)).toBe(true);
  });

  it("preserves the network identifier as-is", () => {
    const path = buildPoolPath("polygon_pos", "0x123");
    expect(path).toBe("/pool/polygon_pos/0x123");
  });

  // ---------------------------------------------------------------------------
  // Optional coinId query context
  // ---------------------------------------------------------------------------

  it("appends coinId as a query parameter when provided", () => {
    const path = buildPoolPath("eth", "0xabc123", "ethereum");
    expect(path).toBe("/pool/eth/0xabc123?coinId=ethereum");
  });

  it("does not include a query string when coinId is omitted", () => {
    const path = buildPoolPath("eth", "0xabc123");
    expect(path).not.toContain("?");
  });

  it("does not include a query string when coinId is empty string", () => {
    const path = buildPoolPath("eth", "0xabc123", "");
    expect(path).not.toContain("?");
  });

  it("encodes special characters in coinId", () => {
    const path = buildPoolPath("eth", "0xabc", "some coin&id");
    expect(path).toBe("/pool/eth/0xabc?coinId=some%20coin%26id");
  });

  // ---------------------------------------------------------------------------
  // coinId is never in the path segment
  // ---------------------------------------------------------------------------

  it("never places coinId in the path segments", () => {
    const path = buildPoolPath("arbitrum", "0xfeed", "wrapped-bitcoin");
    expect(path).toBe("/pool/arbitrum/0xfeed?coinId=wrapped-bitcoin");
    // Path segments are strictly /pool/[network]/[poolAddress]
    const pathParts = path.split("?")[0]!.split("/");
    expect(pathParts).toHaveLength(4); // ["", "pool", "arbitrum", "0xfeed"]
  });

  // ---------------------------------------------------------------------------
  // Unsupported network behavior (permissive by design)
  // ---------------------------------------------------------------------------

  it("accepts an unsupported network identifier without error", () => {
    // The route layer is intentionally permissive: it does not validate
    // network against SUPPORTED_CHAINS. Callers gate that separately.
    const path = buildPoolPath("solana", "So11111111111111");
    expect(path).toBe("/pool/solana/So11111111111111");
  });

  it("accepts a completely arbitrary network string", () => {
    const path = buildPoolPath("unknown-chain", "0xbeef");
    expect(path).toBe("/pool/unknown-chain/0xbeef");
  });
});

// ---------------------------------------------------------------------------
// Pool route metadata contract
// ---------------------------------------------------------------------------

describe("buildPoolMetadata", () => {
  const sampleAddress = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";

  it("produces bounded metadata with pair label and dex name", () => {
    const meta = buildPoolMetadata({
      network: "eth",
      poolAddress: sampleAddress,
      pairLabel: "WETH / USDC",
      dexName: "Uniswap V3",
    });

    expect(meta.title).toContain("WETH / USDC");
    expect(meta.title).toContain("Uniswap V3");
    expect(meta.description).toContain("WETH / USDC");
    expect(meta.description).toContain("eth");
    expect(meta.openGraph?.title).toBe(meta.title);
    expect(meta.openGraph?.description).toBe(meta.description);
    expect((meta.twitter as { card: string }).card).toBe("summary");
  });

  it("canonical URL uses pool path without coinId query", () => {
    const meta = buildPoolMetadata({
      network: "eth",
      poolAddress: sampleAddress,
      pairLabel: "WETH / USDC",
    });

    const canonical = meta.alternates?.canonical as string;
    expect(canonical).not.toContain("?");
    expect(canonical).toContain("/pool/eth/");
    expect(canonical).toContain(sampleAddress);
  });

  it("falls back to shortened address when no pair label", () => {
    const meta = buildPoolMetadata({
      network: "base",
      poolAddress: sampleAddress,
    });

    expect(meta.title).toContain("0x88e6…5640");
    expect(meta.description).toContain("0x88e6…5640");
  });

  it("omits dex name from title when not provided", () => {
    const meta = buildPoolMetadata({
      network: "arbitrum",
      poolAddress: sampleAddress,
      pairLabel: "WETH / USDC",
    });

    expect(meta.title).toContain("WETH / USDC");
    expect(meta.title).not.toContain("on ");
  });

  it("metadata keys are bounded to the contract: title/description/og/twitter/canonical only", () => {
    const meta = buildPoolMetadata({
      network: "eth",
      poolAddress: sampleAddress,
      pairLabel: "WETH / USDC",
    });

    const topKeys = Object.keys(meta).filter((k) => k !== "openGraph" && k !== "twitter" && k !== "alternates");
    expect(topKeys).toEqual(["title", "description"]);
    expect(Object.keys(meta.openGraph as object)).toEqual(["title", "description"]);
    expect(Object.keys(meta.twitter as object)).toEqual(["card"]);
  });
});
