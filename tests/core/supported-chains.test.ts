// =============================================================================
// CryptDash — Supported Chains Contract Test
// =============================================================================

import { describe, it, expect } from "vitest";

import {
  SUPPORTED_CHAINS,
  SUPPORTED_CHAIN_IDS,
  SUPPORTED_CHAIN_LIST,
  ALL_CHAINS,
  OPTIONAL_FUTURE_CHAINS,
  isSupportedChain,
  isKnownChain,
  ETHEREUM,
  BASE,
  ARBITRUM,
  POLYGON,
  BSC,
} from "@/lib/constants";

describe("supported chains include all five enabled chains", () => {
  it("contains exactly Ethereum, Base, Arbitrum, Polygon, and BNB Chain", () => {
    const ids = SUPPORTED_CHAIN_IDS;
    expect(ids).toHaveLength(5);
    expect(ids).toContain(1);       // Ethereum
    expect(ids).toContain(8453);    // Base
    expect(ids).toContain(42161);   // Arbitrum
    expect(ids).toContain(137);     // Polygon
    expect(ids).toContain(56);      // BSC
  });

  it("marks all chains as enabled", () => {
    expect(ETHEREUM.enabled).toBe(true);
    expect(BASE.enabled).toBe(true);
    expect(ARBITRUM.enabled).toBe(true);
    expect(POLYGON.enabled).toBe(true);
    expect(BSC.enabled).toBe(true);
  });

  it("has correct CoinGecko platform identifiers", () => {
    expect(ETHEREUM.coinGeckoPlatform).toBe("ethereum");
    expect(BASE.coinGeckoPlatform).toBe("base");
    expect(ARBITRUM.coinGeckoPlatform).toBe("arbitrum-one");
    expect(POLYGON.coinGeckoPlatform).toBe("polygon-pos");
    expect(BSC.coinGeckoPlatform).toBe("binance-smart-chain");
  });

  it("has correct GeckoTerminal network identifiers", () => {
    expect(ETHEREUM.geckoTerminalNetwork).toBe("eth");
    expect(BASE.geckoTerminalNetwork).toBe("base");
    expect(ARBITRUM.geckoTerminalNetwork).toBe("arbitrum");
    expect(POLYGON.geckoTerminalNetwork).toBe("polygon_pos");
    expect(BSC.geckoTerminalNetwork).toBe("bsc");
  });

  it("isSupportedChain returns true for all supported chains", () => {
    expect(isSupportedChain(1)).toBe(true);
    expect(isSupportedChain(8453)).toBe(true);
    expect(isSupportedChain(42161)).toBe(true);
    expect(isSupportedChain(137)).toBe(true);
    expect(isSupportedChain(56)).toBe(true);
    expect(isSupportedChain(999)).toBe(false);
  });

  it("isKnownChain returns true for all known chains", () => {
    expect(isKnownChain(1)).toBe(true);
    expect(isKnownChain(8453)).toBe(true);
    expect(isKnownChain(42161)).toBe(true);
    expect(isKnownChain(137)).toBe(true);
    expect(isKnownChain(56)).toBe(true);
    expect(isKnownChain(999)).toBe(false);
  });

  it("SUPPORTED_CHAIN_LIST contains all five enabled chains", () => {
    expect(SUPPORTED_CHAIN_LIST).toHaveLength(5);
    expect(SUPPORTED_CHAIN_LIST.every((c) => c.enabled)).toBe(true);
  });

  it("ALL_CHAINS contains all five chains", () => {
    const allIds = Object.keys(ALL_CHAINS).map(Number);
    expect(allIds).toHaveLength(5);
    expect(allIds).toContain(1);
    expect(allIds).toContain(8453);
    expect(allIds).toContain(42161);
    expect(allIds).toContain(137);
    expect(allIds).toContain(56);
  });

  it("has no optional future chains (all are enabled)", () => {
    expect(OPTIONAL_FUTURE_CHAINS).toHaveLength(0);
  });
});
