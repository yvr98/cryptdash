// =============================================================================
// TokenScope — Shared Cache & Response Utilities
// =============================================================================
//
// Centralized cache policy for all route handlers.
// Frozen defaults from plan:
//   - route handler revalidate = 60
//   - Cache-Control: public, s-maxage=60, stale-while-revalidate=120
// =============================================================================

import { isUpstreamError } from "@/lib/api/upstream-error";
/** Revalidation interval in seconds for route handlers. */
export const CACHE_REVALIDATE = 60 as const;

/** Standard Cache-Control header for all API responses. */
export const CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

/** Build a JSON Response with cache headers. */
export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CACHE_HEADERS,
    },
  });
}

/** Build a JSON error Response with cache headers. */
export function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CACHE_HEADERS,
    },
  });
}

/** Map a caught error to an error Response, forwarding UpstreamError status codes. */
export function upstreamErrorResponse(err: unknown, fallbackMessage: string): Response {
  if (isUpstreamError(err)) {
    if (err.category === "not_found") {
      return errorResponse(err.message, 404);
    }
    if (err.category === "rate_limited") {
      return errorResponse(err.message, 429);
    }
    return errorResponse(err.message, 502);
  }
  const message = err instanceof Error ? err.message : fallbackMessage;
  return errorResponse(message, 502);
}
