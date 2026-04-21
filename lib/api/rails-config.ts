// =============================================================================
// TokenScope — Rails Seam Configuration
// =============================================================================
//
// Centralized, server-only module for the Next.js ↔ Rails seam.
// Owns reading and validating RAILS_BASE_URL, route/path constants,
// timeout defaults, and documentary cookie/session/CSRF stance constants.
//
// No other module should read process.env.RAILS_BASE_URL directly.
// =============================================================================

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/** Local development default for the Rails sibling service. */
const RAILS_BASE_URL_DEFAULT = "http://127.0.0.1:3001";

/**
 * Read, trim, and validate the RAILS_BASE_URL environment variable.
 *
 * Returns the validated URL string.
 * - In production: throws if RAILS_BASE_URL is missing or empty.
 * - In development/test: falls back to http://127.0.0.1:3001 when absent.
 * Always throws for malformed or non-HTTP(S) values.
 */
export function getRailsBaseUrl(): string {
  const raw = process.env.RAILS_BASE_URL?.trim();
  const isMissing = !raw || raw.length === 0;

  if (isMissing && process.env.NODE_ENV === "production") {
    throw new Error(
      "RAILS_BASE_URL is required in production. " +
      "Set it to the full HTTP(S) base URL of the Rails backend."
    );
  }

  const url = isMissing ? RAILS_BASE_URL_DEFAULT : raw;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`RAILS_BASE_URL must use http or https protocol, got "${parsed.protocol}"`);
    }
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(
        `RAILS_BASE_URL is not a valid URL: "${url}". ` +
        "Set it to a full HTTP(S) base URL like http://127.0.0.1:3001"
      );
    }
    throw err;
  }

  return url;
}

// ---------------------------------------------------------------------------
// Route / Path Constants
// ---------------------------------------------------------------------------

/** Rails-side path for the session status endpoint (GET). */
export const RAILS_SESSION_PATH = "/api/v1/session" as const;

// ---------------------------------------------------------------------------
// Timeout Defaults
// ---------------------------------------------------------------------------

/** Default request timeout (ms) for calls to the Rails seam. */
export const RAILS_REQUEST_TIMEOUT_MS = 5_000 as const;

// ---------------------------------------------------------------------------
// Cookie / Session / CSRF Stance Constants
// ---------------------------------------------------------------------------
//
// These constants document the current seam stance for cookie forwarding
// and session identification. They are narrow and documentary for this
// slice — actual implementation will consume them in later tasks.
//
// Note: The Rails API controller skips verify_authenticity_token, so CSRF
// token handling is not needed for the current seam.

/**
 * Name of the session cookie set by the Rails app.
 * Used when forwarding cookies between Next.js and Rails.
 */
export const RAILS_SESSION_COOKIE_NAME = "_tokenscope_rails_session" as const;

/**
 * Whether the seam should forward cookies from the browser request
 * to the Rails backend. Currently always true for the local architecture.
 */
export const RAILS_COOKIE_FORWARDING_ENABLED = true as const;
