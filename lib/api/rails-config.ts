// =============================================================================
// TokenScope — Rails Seam Configuration
// =============================================================================
//
// Centralized, server-only module for the Next.js ↔ Rails seam.
// Owns reading and validating RAILS_BASE_URL, internal capture secret
// configuration, route/path constants, timeout defaults, and documentary
// cookie/session/CSRF stance constants.
//
// No other module should read process.env.RAILS_BASE_URL directly.
// =============================================================================

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/** Local development default for the Rails sibling service. */
const RAILS_BASE_URL_DEFAULT = "http://127.0.0.1:3001";

/** Dedicated env var for the internal pool snapshot capture secret. */
const RAILS_INTERNAL_SNAPSHOT_CAPTURE_SECRET_ENV = "INTERNAL_SNAPSHOT_CAPTURE_SECRET";

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

/**
 * Read the dedicated shared secret for the internal snapshot-capture seam.
 *
 * Returns the trimmed secret string when configured.
 * - In production: throws if the secret is missing or empty.
 * - In development/test: returns null when absent so local capture remains
 *   explicitly disabled until configured.
 */
export function getRailsInternalSnapshotCaptureSecret(): string | null {
  const raw = process.env[RAILS_INTERNAL_SNAPSHOT_CAPTURE_SECRET_ENV]?.trim();
  const isMissing = !raw || raw.length === 0;

  if (isMissing) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "INTERNAL_SNAPSHOT_CAPTURE_SECRET is required in production. " +
        "Set it to the dedicated shared secret for the internal snapshot capture seam."
      );
    }

    return null;
  }

  return raw;
}

// ---------------------------------------------------------------------------
// Route / Path Constants
// ---------------------------------------------------------------------------

/** Rails-side path for the session status endpoint (GET). */
export const RAILS_SESSION_PATH = "/api/v1/session" as const;

/** Rails-side header used only for the internal pool snapshot capture seam. */
export const RAILS_INTERNAL_SNAPSHOT_CAPTURE_SECRET_HEADER =
  "X-TokenScope-Internal-Capture-Secret" as const;

/** Rails-side path template for the internal pool snapshot capture seam. */
export const RAILS_POOL_SNAPSHOT_CAPTURE_PATH_TEMPLATE =
  "/api/v1/pools/:network_id/:pool_address/snapshots/capture" as const;

/** Rails-side path template for the public pool snapshot history read seam. */
export const RAILS_POOL_SNAPSHOT_HISTORY_PATH_TEMPLATE =
  "/api/v1/pools/:network_id/:pool_address/snapshots" as const;

function encodeRailsPathSegment(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Rails path requires a non-empty ${field}`);
  }

  return encodeURIComponent(value.trim());
}

/**
 * Build the public snapshot history path for a pool.
 * Centralizes route construction so adapters do not inline Rails route strings.
 */
export function getRailsPoolSnapshotHistoryPath(
  networkId: string,
  poolAddress: string
): string {
  return RAILS_POOL_SNAPSHOT_HISTORY_PATH_TEMPLATE.replace(
    ":network_id",
    encodeRailsPathSegment(networkId, "networkId")
  ).replace(
    ":pool_address",
    encodeRailsPathSegment(poolAddress, "poolAddress")
  );
}

// ---------------------------------------------------------------------------
// Timeout Defaults
// ---------------------------------------------------------------------------

/** Default request timeout (ms) for calls to the Rails seam. */
export const RAILS_REQUEST_TIMEOUT_MS = 5_000 as const;

/** Default request timeout (ms) for internal write calls to the Rails seam. */
export const RAILS_INTERNAL_WRITE_REQUEST_TIMEOUT_MS = 5_000 as const;

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
