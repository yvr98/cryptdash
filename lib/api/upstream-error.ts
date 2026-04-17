// =============================================================================
// TokenScope — Upstream Error Classification
// =============================================================================
//
// Centralized error model for all upstream API failures.
// Adapters throw UpstreamError instead of generic Error so the page-data layer
// can catch, classify, and surface stable degraded states without crashing.
// =============================================================================

/** Broad category of upstream failure for programmatic branching. */
export type UpstreamErrorCategory =
  | "rate_limited"
  | "server_error"
  | "not_found"
  | "timeout"
  | "malformed";

/**
 * Classified upstream error thrown by API adapters.
 *
 * Carries a stable category and source so the page-data layer can decide
 * what to show without parsing error message strings.
 */
export class UpstreamError extends Error {
  readonly category: UpstreamErrorCategory;
  readonly statusCode: number;
  readonly source: string;

  constructor(
    category: UpstreamErrorCategory,
    statusCode: number,
    source: string
  ) {
    super(userFacingMessage(category));
    this.name = "UpstreamError";
    this.category = category;
    this.statusCode = statusCode;
    this.source = source;
  }
}

/**
 * User-facing copy for each error category.
 * Answers: what happened, why, and what the user can trust right now.
 */
export function userFacingMessage(category: UpstreamErrorCategory): string {
  switch (category) {
    case "rate_limited":
      return "The upstream data provider is rate-limiting requests. Some data may be temporarily incomplete. Please try again in a moment.";
    case "server_error":
      return "The upstream data provider returned an error. Pool and market data may be temporarily unavailable.";
    case "not_found":
      return "The requested resource was not found upstream. TokenScope cannot display data for this token.";
    case "timeout":
      return "The upstream data provider did not respond in time. Some data may be temporarily incomplete.";
    case "malformed":
      return "The upstream data provider returned unexpected data. Some information may be unavailable or incomplete.";
  }
}

/**
 * Map an HTTP status code to an UpstreamErrorCategory.
 * Used by adapters at the fetch boundary.
 */
export function classifyHttpStatus(status: number): UpstreamErrorCategory {
  if (status === 429) return "rate_limited";
  if (status === 404) return "not_found";
  if (status === 503) return "server_error";
  if (status >= 500) return "server_error";
  if (status === 408) return "timeout";
  return "server_error";
}

/** Type guard for UpstreamError. */
export function isUpstreamError(err: unknown): err is UpstreamError {
  return err instanceof UpstreamError;
}
