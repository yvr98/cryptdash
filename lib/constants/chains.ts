// =============================================================================
// TokenScope — Supported Chain Definitions
// =============================================================================
//
// Supported chains: Ethereum, Base, Arbitrum, Polygon, BNB Chain
//
// These constants are the single source of truth for which chains the app
// supports, how to identify them with CoinGecko and GeckoTerminal, and
// whether they are active in the current release.
// =============================================================================

import type {
  ChainDef,
  KnownChainId,
  SupportedChainId,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Chain definitions
// ---------------------------------------------------------------------------

/**
 * Ethereum mainnet.
 * GeckoTerminal network: "eth"
 * CoinGecko platform: "ethereum"
 */
export const ETHEREUM: ChainDef = Object.freeze({
  chainId: 1,
  name: "Ethereum",
  geckoTerminalNetwork: "eth",
  coinGeckoPlatform: "ethereum",
  enabled: true,
});

/**
 * Base.
 * GeckoTerminal network: "base"
 * CoinGecko platform: "base"
 */
export const BASE: ChainDef = Object.freeze({
  chainId: 8453,
  name: "Base",
  geckoTerminalNetwork: "base",
  coinGeckoPlatform: "base",
  enabled: true,
});

/**
 * Arbitrum One.
 * GeckoTerminal network: "arbitrum"
 * CoinGecko platform: "arbitrum-one"
 */
export const ARBITRUM: ChainDef = Object.freeze({
  chainId: 42161,
  name: "Arbitrum",
  geckoTerminalNetwork: "arbitrum",
  coinGeckoPlatform: "arbitrum-one",
  enabled: true,
});

/**
 * Polygon PoS.
 * GeckoTerminal network: "polygon_pos"
 * CoinGecko platform: "polygon-pos"
 */
export const POLYGON: ChainDef = Object.freeze({
  chainId: 137,
  name: "Polygon",
  geckoTerminalNetwork: "polygon_pos",
  coinGeckoPlatform: "polygon-pos",
  enabled: true,
});

/**
 * BNB Chain (BSC).
 * GeckoTerminal network: "bsc"
 * CoinGecko platform: "binance-smart-chain"
 */
export const BSC: ChainDef = Object.freeze({
  chainId: 56,
  name: "BNB Chain",
  geckoTerminalNetwork: "bsc",
  coinGeckoPlatform: "binance-smart-chain",
  enabled: true,
});

// ---------------------------------------------------------------------------
// Chain sets
// ---------------------------------------------------------------------------

/**
 * All known chain definitions, keyed by chain ID.
 */
export const ALL_CHAINS: Record<KnownChainId, ChainDef> = Object.freeze({
  1: ETHEREUM,
  8453: BASE,
  42161: ARBITRUM,
  137: POLYGON,
  56: BSC,
});

/**
 * All supported (enabled) chains.
 */
export const SUPPORTED_CHAINS: Record<SupportedChainId, ChainDef> =
  Object.freeze({
    1: ETHEREUM,
    8453: BASE,
    42161: ARBITRUM,
    137: POLYGON,
    56: BSC,
  });

/**
 * Convenience: array of supported chain definitions in display order.
 * Explicitly ordered (not derived from Object.keys, which sorts by numeric key).
 */
export const SUPPORTED_CHAIN_LIST: readonly ChainDef[] = Object.freeze([
  ETHEREUM,
  BASE,
  ARBITRUM,
  POLYGON,
  BSC,
]);

/**
 * Convenience: array of supported chain IDs in display order.
 */
export const SUPPORTED_CHAIN_IDS: readonly SupportedChainId[] = Object.freeze(
  SUPPORTED_CHAIN_LIST.map((c) => c.chainId) as SupportedChainId[]
);

// ---------------------------------------------------------------------------
// Backward compatibility aliases (v1 naming)
// ---------------------------------------------------------------------------

/** @deprecated Use SUPPORTED_CHAINS */
export const REQUIRED_V1_CHAINS = SUPPORTED_CHAINS;
/** @deprecated Use SUPPORTED_CHAIN_IDS */
export const REQUIRED_V1_CHAIN_IDS = SUPPORTED_CHAIN_IDS;
/** @deprecated Use SUPPORTED_CHAIN_LIST */
export const REQUIRED_V1_CHAIN_LIST = SUPPORTED_CHAIN_LIST;

/**
 * Optional future chains not enabled in the current release.
 * Currently empty — all known chains are enabled.
 */
export const OPTIONAL_FUTURE_CHAINS: readonly ChainDef[] = Object.freeze(
  (Object.values(ALL_CHAINS) as ChainDef[]).filter((c) => !c.enabled)
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check whether a chain ID belongs to the supported set. */
export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return chainId in SUPPORTED_CHAINS;
}

/** @deprecated Use isSupportedChain */
export function isRequiredV1Chain(chainId: number): chainId is SupportedChainId {
  return isSupportedChain(chainId);
}

/** Check whether a chain ID is known. */
export function isKnownChain(chainId: number): chainId is KnownChainId {
  return chainId in ALL_CHAINS;
}

/** Get the chain definition for a known chain ID, or undefined. */
export function getChainDef(chainId: number): ChainDef | undefined {
  return ALL_CHAINS[chainId as KnownChainId];
}
