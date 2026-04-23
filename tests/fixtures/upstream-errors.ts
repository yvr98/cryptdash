// =============================================================================
// CryptDash — Upstream Error Fixtures
// =============================================================================
//
// Deterministic fixture data for resilience/error-handling tests.
// Covers: rate limit (429), server error (500), malformed response.
// =============================================================================

export interface UpstreamErrorFixture {
  status: number;
  body: unknown;
  description: string;
}

export const rateLimitResponse: UpstreamErrorFixture = {
  status: 429,
  body: { status: { error_code: 429, error_message: "Rate limit exceeded" } },
  description: "CoinGecko/GeckoTerminal rate limit response",
};

export const serverErrorResponse: UpstreamErrorFixture = {
  status: 500,
  body: { status: { error_code: 500, error_message: "Internal server error" } },
  description: "Upstream server error response",
};

export const malformedJsonResponse: UpstreamErrorFixture = {
  status: 200,
  body: "not valid json structure",
  description: "200 response with unexpected body shape",
};
