// =============================================================================
// CryptDash — Auth Session Route Handler
// =============================================================================
//
// GET /api/auth/session
// Same-origin BFF route that delegates to the verified Rails session adapter.
// Returns the stable SessionResponse contract.
//
// Session responses are intentionally non-cached: no shared revalidate,
// no public cache headers. Each request is forwarded to the Rails backend
// with only the narrow session cookie extracted from the browser request.
//
// This route does NOT export revalidate — session data is per-request and
// must never be edge-cached or statically generated.
// =============================================================================

import { fetchRailsSession } from "@/lib/api/rails-session";
import type { SessionResponse } from "@/lib/types";

// ---------------------------------------------------------------------------
// Session-scoped response helpers (private, never public-cached)
// ---------------------------------------------------------------------------

const SESSION_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store",
};

function sessionResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...SESSION_CACHE_HEADERS,
    },
  });
}

// ---------------------------------------------------------------------------
// Degraded session — stable fallback when the Rails backend is unavailable
// ---------------------------------------------------------------------------

const DEGRADED_SESSION: SessionResponse = Object.freeze({
  authenticated: false,
  status: "degraded",
  user: null,
  capabilities: {
    google_oauth: false,
    write_auth_enabled: false,
  },
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

// Force dynamic rendering — session data is per-request and must never be
// statically generated or edge-cached by Next.js.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Forward only the Cookie header — the adapter internally extracts the
  // narrow session cookie and ignores all other cookies.
  const cookieHeader = request.headers.get("cookie") ?? undefined;

  try {
    const session = await fetchRailsSession(cookieHeader);
    return sessionResponse(session);
  } catch {
    // All adapter failures are mapped to stable shapes upstream.
    // Return the degraded session contract without leaking raw errors.
    return sessionResponse(DEGRADED_SESSION, 502);
  }
}
