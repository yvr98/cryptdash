// =============================================================================
// CryptDash — Rails Session Adapter Tests
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
import { fetchPoolSnapshotHistory } from "@/lib/api/rails-pool-snapshots";
import { UpstreamError, isUpstreamError } from "@/lib/api/upstream-error";
import {
  getRailsPoolSnapshotHistoryPath,
  RAILS_SESSION_COOKIE_NAME,
} from "@/lib/api/rails-config";

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

const RAILS_HISTORY_OK_PAYLOAD = {
  window_hours: 24,
  row_count: 2,
  rows: [
    {
      captured_at: "2026-04-22T10:00:00.000Z",
      liquidity_usd: "1234.56",
      volume_24h_usd: "789.01",
      transactions_24h: 42,
    },
    {
      captured_at: "2026-04-22T11:00:00.000Z",
      liquidity_usd: null,
      volume_24h_usd: "456.78",
      transactions_24h: null,
    },
  ],
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

// ---------------------------------------------------------------------------
// Pool snapshot history adapter
// ---------------------------------------------------------------------------

describe("fetchPoolSnapshotHistory — happy path", () => {
  test("returns normalized PoolSnapshotHistory for valid Rails payload", async () => {
    mockFetchSuccess(RAILS_HISTORY_OK_PAYLOAD);

    const result = await fetchPoolSnapshotHistory({
      networkId: "ethereum",
      poolAddress: "0xAbCdEf1234567890",
    });

    expect(result).toEqual({
      windowHours: 24,
      rowCount: 2,
      rows: [
        {
          capturedAt: "2026-04-22T10:00:00.000Z",
          liquidityUsd: 1234.56,
          volume24hUsd: 789.01,
          transactions24h: 42,
        },
        {
          capturedAt: "2026-04-22T11:00:00.000Z",
          liquidityUsd: null,
          volume24hUsd: 456.78,
          transactions24h: null,
        },
      ],
    });
  });

  test("calls the centralized public history URL with hours=24", async () => {
    mockFetchSuccess(RAILS_HISTORY_OK_PAYLOAD);

    await fetchPoolSnapshotHistory({
      networkId: "ethereum",
      poolAddress: "0xAbCdEf1234567890",
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe(
      `http://127.0.0.1:3001${getRailsPoolSnapshotHistoryPath("ethereum", "0xAbCdEf1234567890")}?hours=24`
    );
    expect(fetchCall[1].method).toBe("GET");
    expect(fetchCall[1].headers.Accept).toBe("application/json");
  });

  test("uses custom Rails base URL from env for history fetches", async () => {
    process.env.RAILS_BASE_URL = "http://rails.internal:4000";
    mockFetchSuccess(RAILS_HISTORY_OK_PAYLOAD);

    await fetchPoolSnapshotHistory({
      networkId: "base",
      poolAddress: "0xpool",
    });

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe(
      `http://rails.internal:4000${getRailsPoolSnapshotHistoryPath("base", "0xpool")}?hours=24`
    );
  });
});

describe("fetchPoolSnapshotHistory — timeout and connection failure", () => {
  test("maps TimeoutError to UpstreamError timeout", async () => {
    mockFetchNetworkError(new DOMException("The operation was aborted", "TimeoutError"));

    await expect(
      fetchPoolSnapshotHistory({ networkId: "ethereum", poolAddress: "0xpool" })
    ).rejects.toMatchObject({
      category: "timeout",
      statusCode: 504,
      source: "rails",
    });
  });

  test("maps TypeError to UpstreamError timeout", async () => {
    mockFetchNetworkError(new TypeError("fetch failed"));

    await expect(
      fetchPoolSnapshotHistory({ networkId: "ethereum", poolAddress: "0xpool" })
    ).rejects.toMatchObject({
      category: "timeout",
      statusCode: 502,
      source: "rails",
    });
  });
});

describe("fetchPoolSnapshotHistory — non-OK responses", () => {
  test("maps 404 to UpstreamError not_found", async () => {
    mockFetchStatus(404, false);

    await expect(
      fetchPoolSnapshotHistory({ networkId: "ethereum", poolAddress: "0xpool" })
    ).rejects.toMatchObject({
      category: "not_found",
      statusCode: 404,
      source: "rails",
    });
  });

  test("maps 500 to UpstreamError server_error", async () => {
    mockFetchStatus(500, false);

    await expect(
      fetchPoolSnapshotHistory({ networkId: "ethereum", poolAddress: "0xpool" })
    ).rejects.toMatchObject({
      category: "server_error",
      statusCode: 500,
      source: "rails",
    });
  });
});

describe("fetchPoolSnapshotHistory — malformed response", () => {
  test("maps JSON parse error to UpstreamError malformed", async () => {
    mockFetchJsonError();

    await expect(
      fetchPoolSnapshotHistory({ networkId: "ethereum", poolAddress: "0xpool" })
    ).rejects.toMatchObject({
      category: "malformed",
      statusCode: 502,
      source: "rails",
    });
  });

  test("rejects payload with unexpected top-level keys", async () => {
    mockFetchSuccess({ ...RAILS_HISTORY_OK_PAYLOAD, extra: true });

    await expect(
      fetchPoolSnapshotHistory({ networkId: "ethereum", poolAddress: "0xpool" })
    ).rejects.toMatchObject({ category: "malformed", statusCode: 502, source: "rails" });
  });

  test("rejects payload with non-array rows", async () => {
    mockFetchSuccess({ ...RAILS_HISTORY_OK_PAYLOAD, rows: null });

    await expect(
      fetchPoolSnapshotHistory({ networkId: "ethereum", poolAddress: "0xpool" })
    ).rejects.toMatchObject({ category: "malformed", statusCode: 502, source: "rails" });
  });

  test("rejects payload when row_count does not match rows length", async () => {
    mockFetchSuccess({ ...RAILS_HISTORY_OK_PAYLOAD, row_count: 1 });

    await expect(
      fetchPoolSnapshotHistory({ networkId: "ethereum", poolAddress: "0xpool" })
    ).rejects.toMatchObject({ category: "malformed", statusCode: 502, source: "rails" });
  });

  test("rejects payload when window_hours is not exactly 24", async () => {
    mockFetchSuccess({ ...RAILS_HISTORY_OK_PAYLOAD, window_hours: 12 });

    await expect(
      fetchPoolSnapshotHistory({ networkId: "ethereum", poolAddress: "0xpool" })
    ).rejects.toMatchObject({ category: "malformed", statusCode: 502, source: "rails" });
  });

  test("rejects row with unexpected keys", async () => {
    mockFetchSuccess({
      ...RAILS_HISTORY_OK_PAYLOAD,
      rows: [{ ...RAILS_HISTORY_OK_PAYLOAD.rows[0], extra: true }],
      row_count: 1,
    });

    await expect(
      fetchPoolSnapshotHistory({ networkId: "ethereum", poolAddress: "0xpool" })
    ).rejects.toMatchObject({ category: "malformed", statusCode: 502, source: "rails" });
  });

  test("rejects row with invalid timestamp", async () => {
    mockFetchSuccess({
      ...RAILS_HISTORY_OK_PAYLOAD,
      rows: [
        {
          ...RAILS_HISTORY_OK_PAYLOAD.rows[0],
          captured_at: "not-a-timestamp",
        },
      ],
      row_count: 1,
    });

    await expect(
      fetchPoolSnapshotHistory({ networkId: "ethereum", poolAddress: "0xpool" })
    ).rejects.toMatchObject({ category: "malformed", statusCode: 502, source: "rails" });
  });

  test("rejects row with invalid decimal string", async () => {
    mockFetchSuccess({
      ...RAILS_HISTORY_OK_PAYLOAD,
      rows: [
        {
          ...RAILS_HISTORY_OK_PAYLOAD.rows[0],
          liquidity_usd: "NaN",
        },
      ],
      row_count: 1,
    });

    await expect(
      fetchPoolSnapshotHistory({ networkId: "ethereum", poolAddress: "0xpool" })
    ).rejects.toMatchObject({ category: "malformed", statusCode: 502, source: "rails" });
  });

  test("rejects row with invalid integer metric", async () => {
    mockFetchSuccess({
      ...RAILS_HISTORY_OK_PAYLOAD,
      rows: [
        {
          ...RAILS_HISTORY_OK_PAYLOAD.rows[0],
          transactions_24h: 3.14,
        },
      ],
      row_count: 1,
    });

    await expect(
      fetchPoolSnapshotHistory({ networkId: "ethereum", poolAddress: "0xpool" })
    ).rejects.toMatchObject({ category: "malformed", statusCode: 502, source: "rails" });
  });

  test("rejects rows that are not chronological oldest-first", async () => {
    mockFetchSuccess({
      ...RAILS_HISTORY_OK_PAYLOAD,
      rows: [...RAILS_HISTORY_OK_PAYLOAD.rows].reverse(),
    });

    await expect(
      fetchPoolSnapshotHistory({ networkId: "ethereum", poolAddress: "0xpool" })
    ).rejects.toMatchObject({ category: "malformed", statusCode: 502, source: "rails" });
  });
});
