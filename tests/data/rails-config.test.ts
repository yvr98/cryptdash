// =============================================================================
// CryptDash — Rails Seam Config Tests
// =============================================================================
//
// Spec: "valid, missing, malformed RAILS_BASE_URL env behavior + production guard"
//
// Tests that getRailsBaseUrl() handles environment-dependent behavior:
//   - Non-production: valid URL → returned; missing/empty → local default
//   - Production: valid URL → returned; missing/empty → throws
//   - All environments: malformed/non-HTTP URL → throws descriptive error
//
// Also verifies route/path constants match the real Rails endpoint
// (GET /api/v1/session) and the shared contract types structurally
// match the verified Rails JSON payload.
// =============================================================================

import { describe, test, expect, beforeEach, afterEach } from "vitest";

import {
  getRailsBaseUrl,
  getRailsInternalSnapshotCaptureSecret,
  RAILS_SESSION_PATH,
  RAILS_INTERNAL_SNAPSHOT_CAPTURE_SECRET_HEADER,
  RAILS_POOL_SNAPSHOT_CAPTURE_PATH_TEMPLATE,
  RAILS_REQUEST_TIMEOUT_MS,
  RAILS_INTERNAL_WRITE_REQUEST_TIMEOUT_MS,
  RAILS_SESSION_COOKIE_NAME,
  RAILS_COOKIE_FORWARDING_ENABLED,
} from "@/lib/api/rails-config";
import type {
  RailsSessionPayload,
  SessionResponse,
} from "@/lib/types";

const ORIGINAL_RAILS_URL = process.env.RAILS_BASE_URL;
const ORIGINAL_CAPTURE_SECRET = process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function setNodeEnv(value: string | undefined): void {
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}

describe("getRailsBaseUrl", () => {
  beforeEach(() => {
    delete process.env.RAILS_BASE_URL;
    delete process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET;
  });

  afterEach(() => {
    if (ORIGINAL_RAILS_URL !== undefined) {
      process.env.RAILS_BASE_URL = ORIGINAL_RAILS_URL;
    } else {
      delete process.env.RAILS_BASE_URL;
    }

    if (ORIGINAL_CAPTURE_SECRET !== undefined) {
      process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET = ORIGINAL_CAPTURE_SECRET;
    } else {
      delete process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET;
    }

    setNodeEnv(ORIGINAL_NODE_ENV);
  });

  // -----------------------------------------------------------------------
  // Non-production fallback
  // -----------------------------------------------------------------------

  test("returns local default when env is not set (non-production)", () => {
    setNodeEnv("test");
    const url = getRailsBaseUrl();
    expect(url).toBe("http://127.0.0.1:3001");
  });

  test("returns local default when env is empty string (non-production)", () => {
    setNodeEnv("development");
    process.env.RAILS_BASE_URL = "";
    const url = getRailsBaseUrl();
    expect(url).toBe("http://127.0.0.1:3001");
  });

  test("returns local default when env is whitespace-only (non-production)", () => {
    setNodeEnv("development");
    process.env.RAILS_BASE_URL = "   ";
    const url = getRailsBaseUrl();
    expect(url).toBe("http://127.0.0.1:3001");
  });

  test("returns valid explicit http URL", () => {
    process.env.RAILS_BASE_URL = "http://rails.internal:4000";
    const url = getRailsBaseUrl();
    expect(url).toBe("http://rails.internal:4000");
  });

  test("returns valid explicit https URL", () => {
    process.env.RAILS_BASE_URL = "https://api.example.com";
    const url = getRailsBaseUrl();
    expect(url).toBe("https://api.example.com");
  });

  test("trims whitespace from valid URL", () => {
    process.env.RAILS_BASE_URL = "  http://localhost:3001  ";
    const url = getRailsBaseUrl();
    expect(url).toBe("http://localhost:3001");
  });

  test("throws for non-URL string", () => {
    process.env.RAILS_BASE_URL = "not-a-url";
    expect(() => getRailsBaseUrl()).toThrow(/not a valid URL/);
  });

  test("throws for ftp:// protocol", () => {
    process.env.RAILS_BASE_URL = "ftp://example.com";
    expect(() => getRailsBaseUrl()).toThrow(/http or https protocol/);
  });

  test("throws for javascript: protocol", () => {
    process.env.RAILS_BASE_URL = "javascript:void(0)";
    expect(() => getRailsBaseUrl()).toThrow(/http or https protocol/);
  });

  test("throws for just a hostname without scheme", () => {
    process.env.RAILS_BASE_URL = "example.com";
    expect(() => getRailsBaseUrl()).toThrow(/not a valid URL/);
  });

  // -----------------------------------------------------------------------
  // Production guard
  // -----------------------------------------------------------------------

  test("throws in production when RAILS_BASE_URL is not set", () => {
    setNodeEnv("production");
    expect(() => getRailsBaseUrl()).toThrow(/RAILS_BASE_URL is required in production/);
  });

  test("throws in production when RAILS_BASE_URL is empty string", () => {
    setNodeEnv("production");
    process.env.RAILS_BASE_URL = "";
    expect(() => getRailsBaseUrl()).toThrow(/RAILS_BASE_URL is required in production/);
  });

  test("throws in production when RAILS_BASE_URL is whitespace-only", () => {
    setNodeEnv("production");
    process.env.RAILS_BASE_URL = "   ";
    expect(() => getRailsBaseUrl()).toThrow(/RAILS_BASE_URL is required in production/);
  });

  test("returns valid URL in production when RAILS_BASE_URL is set", () => {
    setNodeEnv("production");
    process.env.RAILS_BASE_URL = "https://api.render.com";
    expect(getRailsBaseUrl()).toBe("https://api.render.com");
  });

  test("throws in production for malformed RAILS_BASE_URL (not missing-URL error)", () => {
    setNodeEnv("production");
    process.env.RAILS_BASE_URL = "not-a-url";
    expect(() => getRailsBaseUrl()).toThrow(/not a valid URL/);
  });
});

describe("getRailsInternalSnapshotCaptureSecret", () => {
  beforeEach(() => {
    delete process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET;
  });

  afterEach(() => {
    if (ORIGINAL_CAPTURE_SECRET !== undefined) {
      process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET = ORIGINAL_CAPTURE_SECRET;
    } else {
      delete process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET;
    }
    setNodeEnv(ORIGINAL_NODE_ENV);
  });

  test("returns null in test when secret is not set", () => {
    setNodeEnv("test");
    expect(getRailsInternalSnapshotCaptureSecret()).toBeNull();
  });

  test("returns null in development when secret is whitespace-only", () => {
    setNodeEnv("development");
    process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET = "   ";
    expect(getRailsInternalSnapshotCaptureSecret()).toBeNull();
  });

  test("returns trimmed secret when configured", () => {
    setNodeEnv("test");
    process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET = "  shared-secret  ";
    expect(getRailsInternalSnapshotCaptureSecret()).toBe("shared-secret");
  });

  test("throws in production when secret is not set", () => {
    setNodeEnv("production");
    expect(() => getRailsInternalSnapshotCaptureSecret()).toThrow(
      /INTERNAL_SNAPSHOT_CAPTURE_SECRET is required in production/
    );
  });

  test("throws in production when secret is whitespace-only", () => {
    setNodeEnv("production");
    process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET = "   ";
    expect(() => getRailsInternalSnapshotCaptureSecret()).toThrow(
      /INTERNAL_SNAPSHOT_CAPTURE_SECRET is required in production/
    );
  });

  test("public seam constants remain usable when capture secret is absent outside production", () => {
    setNodeEnv("test");
    delete process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET;

    expect(getRailsBaseUrl()).toBe("http://127.0.0.1:3001");
    expect(RAILS_SESSION_PATH).toBe("/api/v1/session");
    expect(getRailsInternalSnapshotCaptureSecret()).toBeNull();
  });
});

describe("Rails seam constants", () => {
  test("RAILS_SESSION_PATH matches actual Rails route /api/v1/session", () => {
    expect(RAILS_SESSION_PATH).toBe("/api/v1/session");
  });

  test("RAILS_POOL_SNAPSHOT_CAPTURE_PATH_TEMPLATE matches the internal write route contract", () => {
    expect(RAILS_POOL_SNAPSHOT_CAPTURE_PATH_TEMPLATE).toBe(
      "/api/v1/pools/:network_id/:pool_address/snapshots/capture"
    );
  });

  test("RAILS_INTERNAL_SNAPSHOT_CAPTURE_SECRET_HEADER is dedicated to internal capture", () => {
    expect(RAILS_INTERNAL_SNAPSHOT_CAPTURE_SECRET_HEADER).toBe(
      "X-CryptDash-Internal-Capture-Secret"
    );
  });

  test("RAILS_REQUEST_TIMEOUT_MS gives Render cold starts room to wake", () => {
    expect(RAILS_REQUEST_TIMEOUT_MS).toBe(30_000);
  });

  test("RAILS_INTERNAL_WRITE_REQUEST_TIMEOUT_MS is 5000", () => {
    expect(RAILS_INTERNAL_WRITE_REQUEST_TIMEOUT_MS).toBe(5_000);
  });

  test("RAILS_SESSION_COOKIE_NAME is set", () => {
    expect(RAILS_SESSION_COOKIE_NAME).toBe("_cryptdash_rails_session");
  });

  test("RAILS_COOKIE_FORWARDING_ENABLED is true", () => {
    expect(RAILS_COOKIE_FORWARDING_ENABLED).toBe(true);
  });
});

describe("RailsSessionPayload contract type", () => {
  test("accepts the verified Rails JSON payload shape", () => {
    const payload: RailsSessionPayload = {
      authenticated: false,
      status: "ok",
      user: null,
      capabilities: {
        google_oauth: false,
        write_auth_enabled: false,
      },
    };

    expect(payload.authenticated).toBe(false);
    expect(payload.status).toBe("ok");
    expect(payload.user).toBeNull();
    expect(payload.capabilities.google_oauth).toBe(false);
    expect(payload.capabilities.write_auth_enabled).toBe(false);
  });

  test("accepts authenticated user payload", () => {
    const payload: RailsSessionPayload = {
      authenticated: true,
      status: "ok",
      user: { email: "test@example.com" },
      capabilities: {
        google_oauth: true,
        write_auth_enabled: false,
      },
    };

    expect(payload.authenticated).toBe(true);
    expect(payload.capabilities.google_oauth).toBe(true);
  });
});

describe("SessionResponse contract type", () => {
  test("accepts a mapped session response", () => {
    const response: SessionResponse = {
      authenticated: false,
      status: "ok",
      user: null,
      capabilities: {
        google_oauth: false,
        write_auth_enabled: false,
      },
    };

    expect(response.authenticated).toBe(false);
    expect(response.status).toBe("ok");
  });

  test("accepts an authenticated session response", () => {
    const response: SessionResponse = {
      authenticated: true,
      status: "ok",
      user: { email: "test@example.com" },
      capabilities: {
        google_oauth: true,
        write_auth_enabled: true,
      },
    };

    expect(response.authenticated).toBe(true);
    expect(response.capabilities.google_oauth).toBe(true);
  });
});
