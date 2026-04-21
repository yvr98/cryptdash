// =============================================================================
// TokenScope — Rails Session Adapter Tests
// =============================================================================
//
// Spec: "happy path, missing env, timeout, connection failure, Rails non-200/5xx,
//        invalid JSON, absent cookie, and explicit forwarding policy"
//
// Mocks global fetch to simulate Rails backend responses. Tests verify:
//   - fetchRailsSession returns a stable SessionResponse on success
//   - Cookie forwarding is explicit and narrow (only allowed cookie names)
//   - All failure modes map to stable UpstreamError categories
//   - Payload validation rejects malformed shapes
// =============================================================================

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

import { fetchRailsSession, buildForwardedCookieHeader } from "@/lib/api/rails-session";
import { UpstreamError, isUpstreamError } from "@/lib/api/upstream-error";
import { RAILS_SESSION_COOKIE_NAME } from "@/lib/api/rails-config";

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const ORIGINAL_ENV = process.env.RAILS_BASE_URL;

// Standard happy-path Rails payload
const RAILS_OK_PAYLOAD = {
  authenticated: false,
  status: "ok",
  user: null,
  capabilities: {
    google_oauth: false,
    write_auth_enabled: false,
  },
};

function mockFetchSuccess(payload: unknown = RAILS_OK_PAYLOAD): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    })
  );
}

function mockFetchStatus(status: number, ok: boolean): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve({ error: "fail" }),
    })
  );
}

function mockFetchNetworkError(error: Error): void {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
}

function mockFetchJsonError(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    })
  );
}

beforeEach(() => {
  delete process.env.RAILS_BASE_URL;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (ORIGINAL_ENV !== undefined) {
    process.env.RAILS_BASE_URL = ORIGINAL_ENV;
  } else {
    delete process.env.RAILS_BASE_URL;
  }
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("fetchRailsSession — happy path", () => {
  test("returns SessionResponse for standard unauthenticated payload", async () => {
    mockFetchSuccess();

    const result = await fetchRailsSession();

    expect(result.authenticated).toBe(false);
    expect(result.status).toBe("ok");
    expect(result.user).toBeNull();
    expect(result.capabilities.google_oauth).toBe(false);
    expect(result.capabilities.write_auth_enabled).toBe(false);
  });

  test("returns SessionResponse for authenticated payload", async () => {
    const authedPayload = {
      authenticated: true,
      status: "ok",
      user: { email: "user@example.com" },
      capabilities: {
        google_oauth: true,
        write_auth_enabled: true,
      },
    };
    mockFetchSuccess(authedPayload);

    const result = await fetchRailsSession();

    expect(result.authenticated).toBe(true);
    expect(result.status).toBe("ok");
    expect(result.user).toEqual({ email: "user@example.com" });
    expect(result.capabilities.google_oauth).toBe(true);
    expect(result.capabilities.write_auth_enabled).toBe(true);
  });

  test("calls correct URL with default base", async () => {
    mockFetchSuccess();

    await fetchRailsSession();

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe("http://127.0.0.1:3001/api/v1/session");
  });

  test("calls correct URL with custom base from env", async () => {
    process.env.RAILS_BASE_URL = "http://rails.internal:4000";
    mockFetchSuccess();

    await fetchRailsSession();

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe("http://rails.internal:4000/api/v1/session");
  });

  test("sends Accept: application/json header", async () => {
    mockFetchSuccess();

    await fetchRailsSession();

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const opts = fetchCall[1];
    expect(opts.headers.Accept).toBe("application/json");
  });
});

// ---------------------------------------------------------------------------
// Cookie forwarding policy
// ---------------------------------------------------------------------------

describe("fetchRailsSession — cookie forwarding policy", () => {
  test("does not send Cookie header when no incoming cookie is provided", async () => {
    mockFetchSuccess();

    await fetchRailsSession();

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const opts = fetchCall[1];
    expect(opts.headers.Cookie).toBeUndefined();
  });

  test("does not send Cookie header when incoming cookies have no allowed names", async () => {
    mockFetchSuccess();

    await fetchRailsSession("theme=dark; lang=en");

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const opts = fetchCall[1];
    expect(opts.headers.Cookie).toBeUndefined();
  });

  test("forwards only the allowed session cookie from incoming header", async () => {
    mockFetchSuccess();

    const cookieHeader = `theme=dark; ${RAILS_SESSION_COOKIE_NAME}=abc123; lang=en`;
    await fetchRailsSession(cookieHeader);

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const opts = fetchCall[1];
    expect(opts.headers.Cookie).toBe(`${RAILS_SESSION_COOKIE_NAME}=abc123`);
  });

  test("forwards session cookie when it is the only cookie", async () => {
    mockFetchSuccess();

    await fetchRailsSession(`${RAILS_SESSION_COOKIE_NAME}=xyz789`);

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const opts = fetchCall[1];
    expect(opts.headers.Cookie).toBe(`${RAILS_SESSION_COOKIE_NAME}=xyz789`);
  });

  test("uses GET method", async () => {
    mockFetchSuccess();

    await fetchRailsSession();

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const opts = fetchCall[1];
    expect(opts.method).toBe("GET");
  });
});

// ---------------------------------------------------------------------------
// buildForwardedCookieHeader — unit tests
// ---------------------------------------------------------------------------

describe("buildForwardedCookieHeader", () => {
  test("returns undefined for undefined input", () => {
    expect(buildForwardedCookieHeader(undefined)).toBeUndefined();
  });

  test("returns undefined for null input", () => {
    expect(buildForwardedCookieHeader(null)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(buildForwardedCookieHeader("")).toBeUndefined();
  });

  test("returns undefined when no allowed cookies are present", () => {
    expect(buildForwardedCookieHeader("foo=bar; baz=qux")).toBeUndefined();
  });

  test("returns only the allowed session cookie", () => {
    const result = buildForwardedCookieHeader(
      `foo=bar; ${RAILS_SESSION_COOKIE_NAME}=sess123; baz=qux`
    );
    expect(result).toBe(`${RAILS_SESSION_COOKIE_NAME}=sess123`);
  });

  test("handles multiple allowed cookies (future-proof)", () => {
    // Currently only one cookie in the allowed set, but this tests
    // the general extraction logic with multiple matches.
    const result = buildForwardedCookieHeader(
      `${RAILS_SESSION_COOKIE_NAME}=abc; other=x; ${RAILS_SESSION_COOKIE_NAME}=def`
    );
    // Both instances of the allowed cookie should be forwarded.
    expect(result).toBe(
      `${RAILS_SESSION_COOKIE_NAME}=abc; ${RAILS_SESSION_COOKIE_NAME}=def`
    );
  });
});

// ---------------------------------------------------------------------------
// Missing / invalid env
// ---------------------------------------------------------------------------

describe("fetchRailsSession — missing env", () => {
  test("uses default URL when RAILS_BASE_URL is not set", async () => {
    mockFetchSuccess();

    const result = await fetchRailsSession();

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe("http://127.0.0.1:3001/api/v1/session");
    expect(result.status).toBe("ok");
  });

  test("throws on malformed RAILS_BASE_URL", async () => {
    process.env.RAILS_BASE_URL = "not-a-url";

    await expect(fetchRailsSession()).rejects.toThrow(/not a valid URL/);
  });
});

// ---------------------------------------------------------------------------
// Timeout / Connection Failure
// ---------------------------------------------------------------------------

describe("fetchRailsSession — timeout and connection failure", () => {
  test("maps TimeoutError (AbortSignal.timeout) to UpstreamError timeout", async () => {
    const timeoutErr = new DOMException("The operation was aborted", "TimeoutError");
    mockFetchNetworkError(timeoutErr);

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      const ue = err as UpstreamError;
      expect(ue.category).toBe("timeout");
      expect(ue.statusCode).toBe(504);
      expect(ue.source).toBe("rails");
    }
  });

  test("maps TypeError (network/connection failure) to UpstreamError timeout", async () => {
    mockFetchNetworkError(new TypeError("fetch failed"));

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      const ue = err as UpstreamError;
      expect(ue.category).toBe("timeout");
      expect(ue.statusCode).toBe(502);
      expect(ue.source).toBe("rails");
    }
  });

  test("maps unexpected error to UpstreamError timeout", async () => {
    mockFetchNetworkError(new Error("something unexpected"));

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      const ue = err as UpstreamError;
      expect(ue.category).toBe("timeout");
      expect(ue.source).toBe("rails");
    }
  });
});

// ---------------------------------------------------------------------------
// Rails non-200 / 5xx responses
// ---------------------------------------------------------------------------

describe("fetchRailsSession — Rails non-200 responses", () => {
  test("maps 500 to UpstreamError server_error", async () => {
    mockFetchStatus(500, false);

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      const ue = err as UpstreamError;
      expect(ue.category).toBe("server_error");
      expect(ue.statusCode).toBe(500);
      expect(ue.source).toBe("rails");
    }
  });

  test("maps 503 to UpstreamError server_error", async () => {
    mockFetchStatus(503, false);

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      const ue = err as UpstreamError;
      expect(ue.category).toBe("server_error");
      expect(ue.statusCode).toBe(503);
      expect(ue.source).toBe("rails");
    }
  });

  test("maps 404 to UpstreamError not_found", async () => {
    mockFetchStatus(404, false);

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      const ue = err as UpstreamError;
      expect(ue.category).toBe("not_found");
      expect(ue.statusCode).toBe(404);
      expect(ue.source).toBe("rails");
    }
  });

  test("maps 429 to UpstreamError rate_limited", async () => {
    mockFetchStatus(429, false);

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      const ue = err as UpstreamError;
      expect(ue.category).toBe("rate_limited");
      expect(ue.statusCode).toBe(429);
      expect(ue.source).toBe("rails");
    }
  });

  test("maps 401 to UpstreamError server_error (generic non-200)", async () => {
    mockFetchStatus(401, false);

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      const ue = err as UpstreamError;
      expect(ue.category).toBe("server_error");
      expect(ue.statusCode).toBe(401);
      expect(ue.source).toBe("rails");
    }
  });
});

// ---------------------------------------------------------------------------
// Invalid / Malformed JSON
// ---------------------------------------------------------------------------

describe("fetchRailsSession — malformed response", () => {
  test("maps JSON parse error to UpstreamError malformed", async () => {
    mockFetchJsonError();

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      const ue = err as UpstreamError;
      expect(ue.category).toBe("malformed");
      expect(ue.statusCode).toBe(502);
      expect(ue.source).toBe("rails");
    }
  });

  test("rejects payload missing authenticated field", async () => {
    mockFetchSuccess({
      status: "ok",
      user: null,
      capabilities: { google_oauth: false, write_auth_enabled: false },
    });

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      expect((err as UpstreamError).category).toBe("malformed");
    }
  });

  test("rejects payload with non-boolean authenticated", async () => {
    mockFetchSuccess({
      authenticated: "yes",
      status: "ok",
      user: null,
      capabilities: { google_oauth: false, write_auth_enabled: false },
    });

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      expect((err as UpstreamError).category).toBe("malformed");
    }
  });

  test("rejects payload missing capabilities", async () => {
    mockFetchSuccess({
      authenticated: false,
      status: "ok",
      user: null,
    });

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      expect((err as UpstreamError).category).toBe("malformed");
    }
  });

  test("rejects payload with non-boolean capability flags", async () => {
    mockFetchSuccess({
      authenticated: false,
      status: "ok",
      user: null,
      capabilities: { google_oauth: "no", write_auth_enabled: false },
    });

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      expect((err as UpstreamError).category).toBe("malformed");
    }
  });

  test("rejects non-object top-level payload (array)", async () => {
    mockFetchSuccess([1, 2, 3]);

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      expect((err as UpstreamError).category).toBe("malformed");
    }
  });

  test("rejects non-object top-level payload (null)", async () => {
    mockFetchSuccess(null);

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      expect((err as UpstreamError).category).toBe("malformed");
    }
  });

  test("rejects payload with non-string status", async () => {
    mockFetchSuccess({
      authenticated: false,
      status: 200,
      user: null,
      capabilities: { google_oauth: false, write_auth_enabled: false },
    });

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      expect((err as UpstreamError).category).toBe("malformed");
    }
  });

  test("rejects payload with non-boolean write_auth_enabled", async () => {
    mockFetchSuccess({
      authenticated: false,
      status: "ok",
      user: null,
      capabilities: { google_oauth: false, write_auth_enabled: "yes" },
    });

    try {
      await fetchRailsSession();
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      expect((err as UpstreamError).category).toBe("malformed");
    }
  });
});
