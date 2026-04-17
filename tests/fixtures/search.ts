// =============================================================================
// TokenScope — Search Result Fixtures
// =============================================================================
//
// Deterministic fixture data for search-related tests.
// Covers: valid results, empty results, ambiguous symbol matches.
// =============================================================================

import type { SearchResult } from "@/lib/types";

// ---------------------------------------------------------------------------
// Valid search results for "ethereum"
// ---------------------------------------------------------------------------

export const validSearchResults: SearchResult[] = [
  {
    coinId: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    thumbUrl: "https://example.com/eth.png",
    marketCapRank: 1,
    platforms: { ethereum: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" },
  },
];

// ---------------------------------------------------------------------------
// Ambiguous search results for "ETH" symbol
// ---------------------------------------------------------------------------

export const ambiguousSearchResults: SearchResult[] = [
  {
    coinId: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    marketCapRank: 1,
    platforms: { ethereum: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" },
  },
  {
    coinId: "eth-2",
    name: "ETH系",
    symbol: "ETH",
    marketCapRank: 1500,
  },
];

// ---------------------------------------------------------------------------
// Empty search results (bad query / no match)
// ---------------------------------------------------------------------------

export const emptySearchResults: SearchResult[] = [];

// ---------------------------------------------------------------------------
// Contract-style queries used to verify exact-match handling
// ---------------------------------------------------------------------------

export const exactContractSearchQuery =
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

export const unresolvedContractSearchQuery =
  "0x1111111111111111111111111111111111111111";

// ---------------------------------------------------------------------------
// Bad search queries that should not produce results
// ---------------------------------------------------------------------------

export const badSearchQueries: string[] = [
  "",
  "   ",
  "!!!@@@###",
  "a",
];
