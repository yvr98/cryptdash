// =============================================================================
// TokenScope — Rails Session Upstream Adapter
// =============================================================================
//
// Server-side adapter for the Rails session-status seam.
// Performs a single fetch to GET /api/v1/session, parses the raw Rails JSON
// payload exactly once, and returns a stable SessionResponse contract.
//
// All upstream error mapping happens at this boundary — route handlers and UI
// code never see raw fetch errors or unparsed Rails shapes.
//
// Cookie/header forwarding policy is explicit and narrow: only the known
// Rails session cookie is forwarded, never arbitrary incoming headers.
// =============================================================================

import type { SessionResponse, RailsSessionPayload } from "@/lib/types";
import {
  getRailsBaseUrl,
  RAILS_SESSION_PATH,
  RAILS_REQUEST_TIMEOUT_MS,
  RAILS_SESSION_COOKIE_NAME,
  RAILS_COOKIE_FORWARDING_ENABLED,
} from "@/lib/api/rails-config";
import { UpstreamError, classifyHttpStatus } from "@/lib/api/upstream-error";

/** Adapter source label for UpstreamError. */
const RAILS_SOURCE = "rails" as const;

// ---------------------------------------------------------------------------
// Cookie / Header Forwarding Policy
// ---------------------------------------------------------------------------

/**
 * Explicit set of cookie names allowed for forwarding to the Rails backend.
 * Only the known Rails session cookie is forwarded — never arbitrary cookies.
 */
const ALLOWED_COOKIES: ReadonlySet<string> = new Set([RAILS_SESSION_COOKIE_NAME]);

/**
 * Build the Cookie header value by extracting only allowed cookies from
 * the incoming request's Cookie header.
 *
 * Returns undefined if forwarding is disabled or no allowed cookies are found.
 */
export function buildForwardedCookieHeader(
  incomingCookieHeader: string | undefined | null
): string | undefined {
  if (!RAILS_COOKIE_FORWARDING_ENABLED) return undefined;
  if (!incomingCookieHeader) return undefined;

  const allowed: string[] = [];

  for (const pair of incomingCookieHeader.split(";")) {
    const trimmed = pair.trim();
    const name = trimmed.split("=")[0]?.trim();
    if (name && ALLOWED_COOKIES.has(name)) {
      allowed.push(trimmed);
    }
  }

  return allowed.length > 0 ? allowed.join("; ") : undefined;
}

// ---------------------------------------------------------------------------
// Payload Validation
// ---------------------------------------------------------------------------

/**
 * Validate that a parsed JSON object has the expected Rails session shape.
 * Returns the object typed as RailsSessionPayload or throws malformed.
 */
function validateSessionPayload(
  raw: unknown,
  label: string
): RailsSessionPayload {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new UpstreamError("malformed", 502, label);
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.authenticated !== "boolean") {
    throw new UpstreamError("malformed", 502, label);
  }

  if (typeof obj.status !== "string") {
    throw new UpstreamError("malformed", 502, label);
  }

  const caps = obj.capabilities;
  if (typeof caps !== "object" || caps === null || Array.isArray(caps)) {
    throw new UpstreamError("malformed", 502, label);
  }

  const capsObj = caps as Record<string, unknown>;
  if (typeof capsObj.google_oauth !== "boolean") {
    throw new UpstreamError("malformed", 502, label);
  }

  if (typeof capsObj.write_auth_enabled !== "boolean") {
    throw new UpstreamError("malformed", 502, label);
  }

  return obj as unknown as RailsSessionPayload;
}

// ---------------------------------------------------------------------------
// Session Fetch — the adapter boundary
// ---------------------------------------------------------------------------

/**
 * Fetch session status from the Rails backend.
 *
 * Performs a server-to-server GET to /api/v1/session, forwards only the
 * allowed session cookie if present, parses the response once, and returns
 * a stable SessionResponse contract.
 *
 * All failure modes are mapped to UpstreamError:
 *   - Missing/invalid RAILS_BASE_URL → propagates from getRailsBaseUrl()
 *   - Timeout or connection failure → UpstreamError("timeout", ...)
 *   - Non-200 Rails response → UpstreamError(classifyHttpStatus(status), ...)
 *   - Malformed JSON or unexpected payload shape → UpstreamError("malformed", ...)
 *
 * @param incomingCookieHeader - The Cookie header from the browser request,
 *   used to forward the session cookie. Pass undefined for unauthenticated
 *   or internal calls.
 */
export async function fetchRailsSession(
  incomingCookieHeader?: string
): Promise<SessionResponse> {
  const baseUrl = getRailsBaseUrl();
  const url = `${baseUrl}${RAILS_SESSION_PATH}`;

  const cookieValue = buildForwardedCookieHeader(incomingCookieHeader);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (cookieValue) {
    headers.Cookie = cookieValue;
  }

  let res: Response;

  try {
    res = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(RAILS_REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    // AbortSignal.timeout throws a DOMException on timeout.
    // Network failures (ECONNREFUSED, DNS errors) throw TypeError.
    // Both are mapped to the "timeout" category for stable downstream handling.
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new UpstreamError("timeout", 504, RAILS_SOURCE);
    }
    if (err instanceof TypeError) {
      throw new UpstreamError("timeout", 502, RAILS_SOURCE);
    }
    // Unexpected error — still wrap as timeout since the call didn't complete.
    throw new UpstreamError("timeout", 502, RAILS_SOURCE);
  }

  if (!res.ok) {
    throw new UpstreamError(
      classifyHttpStatus(res.status),
      res.status,
      RAILS_SOURCE
    );
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new UpstreamError("malformed", 502, RAILS_SOURCE);
  }

  const payload = validateSessionPayload(raw, RAILS_SOURCE);

  // Map the raw Rails payload to the stable SessionResponse contract.
  // The shapes are currently identical, but mapping through a dedicated
  // step keeps the boundary explicit for future divergence.
  return {
    authenticated: payload.authenticated,
    status: payload.status,
    user: payload.user,
    capabilities: {
      google_oauth: payload.capabilities.google_oauth,
      write_auth_enabled: payload.capabilities.write_auth_enabled,
    },
  };
}
