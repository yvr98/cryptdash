// =============================================================================
// TokenScope — Search / Typeahead Route Handler
// =============================================================================
//
// GET /api/search?q=<query>
// Returns normalized SearchResult[] from CoinGecko.
// Revalidates every 60s with explicit Cache-Control header.
// =============================================================================

import { NextRequest } from "next/server";

import { getCoinDetail, searchCoins } from "@/lib/api/coingecko";
import { jsonResponse, upstreamErrorResponse } from "@/lib/api/cache";
import { SUPPORTED_CHAIN_LIST } from "@/lib/constants";
import type { SearchResult } from "@/lib/types";

export const revalidate = 60;

const SEARCH_DETAIL_LIMIT = 6;

const SEARCH_ALIAS_COIN_IDS = Object.freeze<Record<string, readonly string[]>>({
  bitcoin: ["wrapped-bitcoin"],
  btc: ["wrapped-bitcoin"],
});

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function hasSupportedPlatform(result: SearchResult) {
  return SUPPORTED_CHAIN_LIST.some((chain) =>
    Boolean(result.platforms?.[chain.coinGeckoPlatform]?.trim())
  );
}

function toSearchResult(detail: Awaited<ReturnType<typeof getCoinDetail>>): SearchResult {
  return {
    coinId: detail.token.coinId,
    name: detail.token.name,
    symbol: detail.token.symbol,
    thumbUrl: detail.token.thumbUrl,
    marketCapRank: detail.token.marketCapRank ?? null,
    platforms: detail.platforms,
  };
}

function mergeSearchResult(base: SearchResult, detail: Awaited<ReturnType<typeof getCoinDetail>> | null) {
  if (!detail) {
    return base;
  }

  const basePlatforms = base.platforms ?? {};

  return {
    ...base,
    thumbUrl: base.thumbUrl ?? detail.token.thumbUrl,
    marketCapRank: base.marketCapRank ?? detail.token.marketCapRank ?? null,
    platforms: Object.keys(basePlatforms).length > 0 ? basePlatforms : detail.platforms,
  };
}

function rankSearchResults(results: SearchResult[]) {
  return [...results].sort((left, right) => {
    const supportDelta = Number(hasSupportedPlatform(right)) - Number(hasSupportedPlatform(left));

    if (supportDelta !== 0) {
      return supportDelta;
    }

    const leftRank = left.marketCapRank ?? Number.POSITIVE_INFINITY;
    const rightRank = right.marketCapRank ?? Number.POSITIVE_INFINITY;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.name.localeCompare(right.name);
  });
}

async function enrichSearchResults(results: SearchResult[]) {
  const detailResults = await Promise.all(
    results.slice(0, SEARCH_DETAIL_LIMIT).map(async (result) => {
      try {
        return await getCoinDetail(result.coinId);
      } catch {
        return null;
      }
    })
  );

  return results.map((result, index) => mergeSearchResult(result, detailResults[index] ?? null));
}

async function loadAliasResults(query: string, existingResults: SearchResult[]) {
  const aliasCoinIds = SEARCH_ALIAS_COIN_IDS[normalizeQuery(query)] ?? [];
  const existingCoinIds = new Set(existingResults.map((result) => result.coinId));

  const aliasDetails = await Promise.all(
    aliasCoinIds
      .filter((coinId) => !existingCoinIds.has(coinId))
      .map(async (coinId) => {
        try {
          return await getCoinDetail(coinId);
        } catch {
          return null;
        }
      })
  );

  return aliasDetails.filter((detail) => detail !== null).map(toSearchResult);
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (!q || !q.trim()) {
    return jsonResponse([]);
  }

  try {
    const searchResults = await searchCoins(q.trim());
    const enrichedResults = await enrichSearchResults(searchResults);
    const aliasResults = await loadAliasResults(q.trim(), enrichedResults);

    return jsonResponse(rankSearchResults([...enrichedResults, ...aliasResults]));
  } catch (err) {
    return upstreamErrorResponse(err, "Upstream search failed");
  }
}
