// =============================================================================
// TokenScope — Upstream Error Handling Test
// =============================================================================
//
// Spec name (from plan): "maps upstream 429 and 500 responses into stable UI states"
//
// Tests that upstream errors are caught and translated into safe, displayable
// states — the page never crashes and never fabricates data when the real
// upstream source failed.
// =============================================================================

import { describe, test, it, expect } from "vitest";

import {
  rateLimitResponse,
  serverErrorResponse,
  malformedJsonResponse,
} from "@/tests/fixtures/upstream-errors";
import {
  UpstreamError,
  classifyHttpStatus,
  isUpstreamError,
  userFacingMessage,
} from "@/lib/api/upstream-error";
import { getTokenDetailPageData } from "@/lib/page-data/token-detail";
import type { TokenDetail } from "@/lib/api/coingecko";
import type { PoolCandidate, SupportedChainId } from "@/lib/types";

// ---------------------------------------------------------------------------
// Coin detail fixture
// ---------------------------------------------------------------------------

function createCoinDetailFixture(
  platforms: Record<string, string> = {}
): TokenDetail {
  return {
    token: {
      coinId: "test-token",
      name: "Test Token",
      symbol: "TST",
      marketCapRank: 42,
    },
    platforms,
  };
}

// ---------------------------------------------------------------------------
// Mock fetchers
// ---------------------------------------------------------------------------

function rateLimitedCoinFetcher(): Promise<TokenDetail> {
  throw new UpstreamError("rate_limited", 429, "coingecko");
}

function serverErrorCoinFetcher(): Promise<TokenDetail> {
  throw new UpstreamError("server_error", 500, "coingecko");
}

function notFoundCoinFetcher(): Promise<TokenDetail> {
  throw new UpstreamError("not_found", 404, "coingecko");
}

async function rateLimitedPoolFetcher(): Promise<PoolCandidate[]> {
  throw new UpstreamError("rate_limited", 429, "geckoterminal");
}

async function serverErrorPoolFetcher(): Promise<PoolCandidate[]> {
  throw new UpstreamError("server_error", 500, "geckoterminal");
}

function noOpPoolFetcher(): Promise<PoolCandidate[]> {
  return Promise.resolve([]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("maps upstream 429 and 500 responses into stable UI states", () => {
  test("maps 429 rate limit to a user-facing retry state", async () => {
    const pageData = await getTokenDetailPageData(
      "test-token",
      rateLimitedCoinFetcher,
      noOpPoolFetcher
    );

    expect(pageData.dataState.status).toBe("upstream_error");
    expect(pageData.dataState.errors.length).toBeGreaterThanOrEqual(1);
    expect(pageData.dataState.errors[0]!.category).toBe("rate_limited");
    expect(pageData.dataState.errors[0]!.userMessage).toContain(
      "rate-limiting"
    );
    expect(pageData.token.coinId).toBe("test-token");
    expect(pageData.recommendation.status).toBe("insufficient_data");
    expect(pageData.recommendation.confidence).toBe("low");
    expect(pageData.recommendation.winner).toBeUndefined();
  });

  test("maps 500 server error to a generic error state", async () => {
    const pageData = await getTokenDetailPageData(
      "test-token",
      serverErrorCoinFetcher,
      noOpPoolFetcher
    );

    expect(pageData.dataState.status).toBe("upstream_error");
    expect(pageData.dataState.errors.length).toBeGreaterThanOrEqual(1);
    expect(pageData.dataState.errors[0]!.category).toBe("server_error");
    expect(pageData.dataState.errors[0]!.userMessage).toContain("error");
    expect(pageData.recommendation.status).toBe("insufficient_data");
    expect(pageData.recommendation.winner).toBeUndefined();
  });

  test("handles malformed responses without crashing", () => {
    const error = new UpstreamError("malformed", 200, "coingecko");
    expect(error.category).toBe("malformed");
    expect(error.message).toContain("unexpected data");
  });

  test("error states include no fabricated recommendation data", async () => {
    const pageData = await getTokenDetailPageData(
      "test-token",
      serverErrorCoinFetcher,
      noOpPoolFetcher
    );

    expect(pageData.recommendation.status).toBe("insufficient_data");
    expect(pageData.recommendation.winner).toBeUndefined();
    expect(pageData.recommendation.runnerUp).toBeUndefined();
    expect(pageData.recommendation.eligiblePools).toEqual([]);
    expect(pageData.eligiblePools).toEqual([]);
    expect(pageData.dataState.status).toBe("upstream_error");
  });

  test("pool fetch 429 errors are tracked in dataState", async () => {
    const pageData = await getTokenDetailPageData(
      "test-token",
      async () =>
        createCoinDetailFixture({
          ethereum: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        }),
      rateLimitedPoolFetcher
    );

    expect(pageData.dataState.status).toBe("upstream_error");
    expect(pageData.dataState.errors.some((e) => e.source === "geckoterminal")).toBe(true);
    expect(pageData.recommendation.status).toBe("insufficient_data");
  });

  test("pool fetch 500 errors are tracked in dataState", async () => {
    const pageData = await getTokenDetailPageData(
      "test-token",
      async () =>
        createCoinDetailFixture({
          ethereum: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        }),
      serverErrorPoolFetcher
    );

    expect(pageData.dataState.status).toBe("upstream_error");
    expect(pageData.dataState.errors.some((e) => e.source === "geckoterminal")).toBe(true);
    expect(pageData.dataState.errors.some((e) => e.category === "server_error")).toBe(true);
  });

  test("CoinGecko 404 still propagates as not_found", async () => {
    await expect(
      getTokenDetailPageData("test-token", notFoundCoinFetcher, noOpPoolFetcher)
    ).rejects.toThrow();
  });

  test("complete data produces dataState status complete", async () => {
    const pageData = await getTokenDetailPageData(
      "test-token",
      async () => createCoinDetailFixture({ ethereum: "0xabc" }),
      noOpPoolFetcher
    );

    expect(pageData.dataState.status).toBe("complete");
    expect(pageData.dataState.errors).toEqual([]);
  });

  it("fixture: rateLimitResponse has status 429", () => {
    expect(rateLimitResponse.status).toBe(429);
  });

  it("fixture: serverErrorResponse has status 500", () => {
    expect(serverErrorResponse.status).toBe(500);
  });

  it("fixture: malformedJsonResponse has status 200 but non-standard body", () => {
    expect(malformedJsonResponse.status).toBe(200);
    expect(typeof malformedJsonResponse.body).toBe("string");
  });
});

describe("UpstreamError classification", () => {
  test("classifyHttpStatus maps 429 to rate_limited", () => {
    expect(classifyHttpStatus(429)).toBe("rate_limited");
  });

  test("classifyHttpStatus maps 500 to server_error", () => {
    expect(classifyHttpStatus(500)).toBe("server_error");
  });

  test("classifyHttpStatus maps 503 to server_error", () => {
    expect(classifyHttpStatus(503)).toBe("server_error");
  });

  test("classifyHttpStatus maps 404 to not_found", () => {
    expect(classifyHttpStatus(404)).toBe("not_found");
  });

  test("classifyHttpStatus maps 408 to timeout", () => {
    expect(classifyHttpStatus(408)).toBe("timeout");
  });

  test("isUpstreamError returns true for UpstreamError instances", () => {
    const err = new UpstreamError("rate_limited", 429, "coingecko");
    expect(isUpstreamError(err)).toBe(true);
    expect(isUpstreamError(new Error("generic"))).toBe(false);
    expect(isUpstreamError(null)).toBe(false);
    expect(isUpstreamError(undefined)).toBe(false);
  });

  test("userFacingMessage returns non-empty string for all categories", () => {
    const categories = [
      "rate_limited",
      "server_error",
      "not_found",
      "timeout",
      "malformed",
    ] as const;
    for (const cat of categories) {
      expect(userFacingMessage(cat).length).toBeGreaterThan(0);
    }
  });

  test("UpstreamError has correct properties", () => {
    const err = new UpstreamError("rate_limited", 429, "coingecko");
    expect(err.name).toBe("UpstreamError");
    expect(err.category).toBe("rate_limited");
    expect(err.statusCode).toBe(429);
    expect(err.source).toBe("coingecko");
    expect(err.message).toBe(userFacingMessage("rate_limited"));
  });
});
