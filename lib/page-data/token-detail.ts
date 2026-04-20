// =============================================================================
// TokenScope — Token Detail Page Data
// =============================================================================
//
// Server-side page model for /token/[coinId].
// Builds a unified supported-chain view from the canonical CoinGecko token
// identity while deliberately excluding unsupported platforms from the main UI.
// Also fetches and filters pool candidates from GeckoTerminal per supported chain.
//
// Upstream errors (429, 500, 503, timeouts, malformed responses) are caught
// here and surfaced as stable degraded states — the page never crashes and
// never fabricates data when the real upstream source failed.
// =============================================================================

import { getCoinDetail, type TokenDetail } from "@/lib/api/coingecko";
import { fetchPoolsForToken } from "@/lib/api/geckoterminal";
import {
  isUpstreamError,
  type UpstreamErrorCategory,
} from "@/lib/api/upstream-error";
import { SUPPORTED_CHAIN_LIST } from "@/lib/constants";
import { filterEligible } from "@/lib/recommendation/eligibility";
import { recommend } from "@/lib/recommendation/recommend";
import type {
  MarketData,
  PoolCandidate,
  Recommendation,
  SupportedChainId,
  Token,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Page data types
// ---------------------------------------------------------------------------

export interface TokenDetailResearchLink {
  label: string;
  href: string;
}

export interface TokenDetailSupportedChain {
  chainId: SupportedChainId;
  name: string;
  platformId: string;
  geckoTerminalNetwork: string;
  contractAddress?: string;
  geckoTerminalTokenUrl?: string;
  isAvailable: boolean;
}

export interface TokenDetailFallback {
  title: string;
  description: string;
}

/** Serializable upstream error info for the page model. */
export interface UpstreamErrorInfo {
  category: UpstreamErrorCategory;
  source: string;
  userMessage: string;
}

/** Degraded-state metadata — orthogonal to recommendation status. */
export interface DataState {
  /** "complete" = all upstream calls succeeded; "upstream_error" = at least one failed. */
  status: "complete" | "upstream_error";
  /** Individual upstream errors that were caught and suppressed. */
  errors: UpstreamErrorInfo[];
}

export interface TokenDetailPageData {
  token: Token;
  marketData: MarketData;
  priceContext: {
    marketCapRank: number | null;
  };
  supportedChains: TokenDetailSupportedChain[];
  availableSupportedChains: TokenDetailSupportedChain[];
  externalLinks: TokenDetailResearchLink[];
  fallback: TokenDetailFallback | null;
  eligiblePools: PoolCandidate[];
  recommendation: Recommendation;
  dataState: DataState;
}

// ---------------------------------------------------------------------------
// Dependency injection types
// ---------------------------------------------------------------------------

type CoinDetailFetcher = (coinId: string) => Promise<TokenDetail>;

type PoolFetcher = (
  network: string,
  chainId: SupportedChainId,
  contractAddress: string
) => Promise<PoolCandidate[]>;

const COIN_PLATFORM_OVERRIDES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({
    ethereum: Object.freeze({
      ethereum: "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2",
      base: "0x4200000000000000000000000000000000000006",
      "arbitrum-one": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      "polygon-pos": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
      "binance-smart-chain": "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",
    }),
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeAddress(address: string | undefined) {
  const trimmed = address?.trim();
  return trimmed ? trimmed : undefined;
}

function resolvePlatforms(
  coinId: string,
  platforms: Record<string, string>
): Record<string, string> {
  const overrides = COIN_PLATFORM_OVERRIDES[coinId];

  if (!overrides) {
    return platforms;
  }

  return {
    ...overrides,
    ...platforms,
  };
}

function buildSupportedChains(
  coinId: string,
  platforms: Record<string, string>
): TokenDetailSupportedChain[] {
  const resolvedPlatforms = resolvePlatforms(coinId, platforms);

  return SUPPORTED_CHAIN_LIST.map((chain) => {
    const contractAddress = normalizeAddress(
      resolvedPlatforms[chain.coinGeckoPlatform]
    );

    return {
      chainId: chain.chainId as SupportedChainId,
      name: chain.name,
      platformId: chain.coinGeckoPlatform,
      geckoTerminalNetwork: chain.geckoTerminalNetwork,
      contractAddress,
      geckoTerminalTokenUrl: contractAddress
        ? `https://www.geckoterminal.com/${chain.geckoTerminalNetwork}/tokens/${contractAddress}`
        : undefined,
      isAvailable: Boolean(contractAddress),
    };
  });
}

function buildExternalLinks(
  coinId: string,
  supportedChains: TokenDetailSupportedChain[]
): TokenDetailResearchLink[] {
  return [
    {
      label: "CoinGecko",
      href: `https://www.coingecko.com/en/coins/${coinId}`,
    },
    ...supportedChains.flatMap((chain) =>
      chain.geckoTerminalTokenUrl
        ? [
            {
              label: `GeckoTerminal · ${chain.name}`,
              href: chain.geckoTerminalTokenUrl,
            },
          ]
        : []
    ),
  ];
}

function toErrorInfo(err: unknown): UpstreamErrorInfo {
  if (isUpstreamError(err)) {
    return {
      category: err.category,
      source: err.source,
      userMessage: err.message,
    };
  }
  return {
    category: "server_error",
    source: "unknown",
    userMessage: "An unexpected error occurred while fetching data.",
  };
}

// ---------------------------------------------------------------------------
// Pool fetching with error tracking
// ---------------------------------------------------------------------------

interface PoolFetchResult {
  pools: PoolCandidate[];
  errors: UpstreamErrorInfo[];
}

async function fetchAllPools(
  availableChains: TokenDetailSupportedChain[],
  fetcher: PoolFetcher = fetchPoolsForToken
): Promise<PoolFetchResult> {
  const results = await Promise.allSettled(
    availableChains.map((chain) =>
      fetcher(
        chain.geckoTerminalNetwork,
        chain.chainId,
        chain.contractAddress!
      )
    )
  );

  const pools: PoolCandidate[] = [];
  const errors: UpstreamErrorInfo[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      pools.push(...result.value);
    } else {
      errors.push(toErrorInfo(result.reason));
    }
  }

  return { pools, errors };
}

// ---------------------------------------------------------------------------
// Main page data assembly
// ---------------------------------------------------------------------------

/**
 * Build the complete page model for /token/[coinId].
 *
 * Catches upstream errors instead of letting them crash the page:
 * - CoinGecko 404 still propagates for notFound()
 * - CoinGecko 429/500/503 → stub token + upstream_error dataState
 * - GeckoTerminal failures → tracked in dataState, pools list may be empty
 *
 * The recommendation engine only sees the pools that were successfully fetched
 * and pass eligibility, so it never fabricates a winner from missing data.
 */
export async function getTokenDetailPageData(
  coinId: string,
  fetchCoinDetail: CoinDetailFetcher = getCoinDetail,
  fetchPools: PoolFetcher = fetchPoolsForToken
): Promise<TokenDetailPageData> {
  const upstreamErrors: UpstreamErrorInfo[] = [];
  let dataStatus: "complete" | "upstream_error" = "complete";

  // --- CoinGecko token detail ---
  let detail: TokenDetail;

  try {
    detail = await fetchCoinDetail(coinId);
  } catch (err) {
    // 404 still propagates to trigger Next.js notFound()
    if (isUpstreamError(err) && err.category === "not_found") {
      throw err;
    }

    // Other upstream errors: build a stub token so the page renders
    // a degraded shell instead of crashing
    upstreamErrors.push(toErrorInfo(err));
    dataStatus = "upstream_error";

    detail = {
      token: { coinId, name: coinId, symbol: "" },
      platforms: {},
    };
  }

  const supportedChains = buildSupportedChains(detail.token.coinId, detail.platforms);
  const availableSupportedChains = supportedChains.filter(
    (chain) => chain.isAvailable
  );

  // --- GeckoTerminal pool fetching ---
  let eligiblePools: PoolCandidate[] = [];

  if (availableSupportedChains.length > 0) {
    const result = await fetchAllPools(availableSupportedChains, fetchPools);
    eligiblePools = filterEligible(result.pools);

    if (result.errors.length > 0) {
      upstreamErrors.push(...result.errors);
      dataStatus = "upstream_error";
    }
  }

  const recommendation = recommend(eligiblePools);
  // Use recommendation-sorted pools (scored order) for display
  const displayPools = recommendation.eligiblePools;

  const emptyMarketData: MarketData = {
    currentPriceUsd: null,
    priceChange24hPercent: null,
    marketCap: null,
    totalVolume24h: null,
    circulatingSupply: null,
    fullyDilutedValuation: null,
  };

  return {
    token: detail.token,
    marketData: detail.token.marketData ?? emptyMarketData,
    priceContext: {
      marketCapRank: detail.token.marketCapRank ?? null,
    },
    supportedChains,
    availableSupportedChains,
    externalLinks: buildExternalLinks(
      detail.token.coinId,
      availableSupportedChains
    ),
    fallback:
      availableSupportedChains.length > 0
        ? null
        : {
            title: "No supported chain mappings",
            description:
              "This token was found on CoinGecko but doesn't have a contract mapping on any of the currently supported chains.",
          },
    eligiblePools: displayPools,
    recommendation,
    dataState: {
      status: dataStatus,
      errors: upstreamErrors,
    },
  };
}

// ---------------------------------------------------------------------------
// Deterministic e2e fixture fetchers
// ---------------------------------------------------------------------------

export interface TokenDetailFixtureFetchers {
  fetchCoinDetail: CoinDetailFetcher;
  fetchPools: PoolFetcher;
}

/**
 * Return deterministic token-detail fixture fetchers by name, or undefined.
 * Used by app/token/[coinId]/page.tsx via ?fixture= query param for e2e testing.
 *
 * - "pool-link": minimal ethereum token detail fixture with one eligible pool
 *                so Playwright can deterministically prove token → pool navigation.
 */
export function getTokenDetailFixtureFetchers(
  name: string
): TokenDetailFixtureFetchers | undefined {
  switch (name) {
    case "pool-link":
      return {
        fetchCoinDetail: tokenPoolLinkCoinDetailFixtureFetcher,
        fetchPools: tokenPoolLinkPoolFixtureFetcher,
      };
    default:
      return undefined;
  }
}

async function tokenPoolLinkCoinDetailFixtureFetcher(
  coinId: string
): Promise<TokenDetail> {
  return {
    token: {
      coinId,
      name: "Ethereum",
      symbol: "eth",
      marketCapRank: 1,
      marketData: {
        currentPriceUsd: 3_000,
        priceChange24hPercent: 2.5,
        marketCap: 360_000_000_000,
        totalVolume24h: 18_000_000_000,
        circulatingSupply: 120_000_000,
        fullyDilutedValuation: 360_000_000_000,
      },
    },
    platforms: {
      ethereum: "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2",
    },
  };
}

async function tokenPoolLinkPoolFixtureFetcher(
  network: string,
  chainId: SupportedChainId,
  contractAddress: string
): Promise<PoolCandidate[]> {
  if (
    network !== "eth" ||
    chainId !== 1 ||
    contractAddress.toLowerCase() !==
      "0xc02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2".toLowerCase()
  ) {
    return [];
  }

  return [
    {
      poolAddress: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
      chainId: 1,
      dexName: "Uniswap V3",
      pairLabel: "WETH / USDC",
      baseTokenPriceUsd: 3_000,
      quoteTokenPriceUsd: 1,
      liquidityUsd: 12_500_000,
      volume24hUsd: 3_400_000,
      transactions24h: 1_234,
      priceChange24h: 2.1,
    },
  ];
}
