// =============================================================================
// TokenScope — Auth Session Route Tests
// =============================================================================
//
// Covers: happy path mapping, degraded behavior, cookie forwarding policy,
// non-cached session semantics, and correct dynamic/revalidate exports.
//
// Mocks the Rails session adapter so tests are isolated from the backend.
// =============================================================================

import { describe, test, expect, vi, beforeEach } from "vitest";

import { RAILS_SESSION_COOKIE_NAME } from "@/lib/api/rails-config";

// ---------------------------------------------------------------------------
// Adapter mock
// ---------------------------------------------------------------------------

const fetchRailsSession = vi.fn();

vi.mock("@/lib/api/rails-session", () => ({
  fetchRailsSession,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STANDARD_SESSION = {
  authenticated: false,
  status: "ok",
  user: null,
  capabilities: { google_oauth: false, write_auth_enabled: false },
};

const AUTHED_SESSION = {
  authenticated: true,
  status: "ok",
  user: { email: "user@example.com" },
  capabilities: { google_oauth: true, write_auth_enabled: true },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/auth/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  test("returns SessionResponse on success", async () => {
    fetchRailsSession.mockResolvedValueOnce(STANDARD_SESSION);

    const { GET } = await import("@/app/api/auth/session/route");
    const response = await GET(new Request("http://localhost:3000/api/auth/session"));

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual(STANDARD_SESSION);
  });

  test("returns authenticated SessionResponse when adapter returns one", async () => {
    fetchRailsSession.mockResolvedValueOnce(AUTHED_SESSION);

    const { GET } = await import("@/app/api/auth/session/route");
    const response = await GET(new Request("http://localhost:3000/api/auth/session"));

    const body = await response.json();
    expect(body.authenticated).toBe(true);
    expect(body.user).toEqual({ email: "user@example.com" });
    expect(body.capabilities.google_oauth).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Cookie forwarding
  // -------------------------------------------------------------------------

  test("forwards cookie header to the adapter", async () => {
    fetchRailsSession.mockResolvedValueOnce(STANDARD_SESSION);

    const cookieHeader = `${RAILS_SESSION_COOKIE_NAME}=abc123; theme=dark`;
    const request = new Request("http://localhost:3000/api/auth/session", {
      headers: { cookie: cookieHeader },
    });

    const { GET } = await import("@/app/api/auth/session/route");
    await GET(request);

    expect(fetchRailsSession).toHaveBeenCalledWith(cookieHeader);
  });

  test("passes undefined when request has no Cookie header", async () => {
    fetchRailsSession.mockResolvedValueOnce(STANDARD_SESSION);

    const { GET } = await import("@/app/api/auth/session/route");
    await GET(new Request("http://localhost:3000/api/auth/session"));

    expect(fetchRailsSession).toHaveBeenCalledWith(undefined);
  });

  test("passes empty string cookie header to adapter", async () => {
    fetchRailsSession.mockResolvedValueOnce(STANDARD_SESSION);

    const request = new Request("http://localhost:3000/api/auth/session", {
      headers: { cookie: "" },
    });

    const { GET } = await import("@/app/api/auth/session/route");
    await GET(request);

    // Empty string cookie → adapter receives empty string
    expect(fetchRailsSession).toHaveBeenCalledWith("");
  });

  // -------------------------------------------------------------------------
  // Degraded response
  // -------------------------------------------------------------------------

  test("returns degraded session with 502 when adapter throws", async () => {
    fetchRailsSession.mockRejectedValueOnce(new Error("Connection refused"));

    const { GET } = await import("@/app/api/auth/session/route");
    const response = await GET(new Request("http://localhost:3000/api/auth/session"));

    expect(response.status).toBe(502);

    const body = await response.json();
    expect(body.authenticated).toBe(false);
    expect(body.status).toBe("degraded");
    expect(body.user).toBeNull();
    expect(body.capabilities.google_oauth).toBe(false);
    expect(body.capabilities.write_auth_enabled).toBe(false);
  });

  test("degraded response does not leak raw error details", async () => {
    fetchRailsSession.mockRejectedValueOnce(new Error("secret internal detail"));

    const { GET } = await import("@/app/api/auth/session/route");
    const response = await GET(new Request("http://localhost:3000/api/auth/session"));

    const body = await response.json();
    // Body is a valid SessionResponse shape — no "error" or "message" field
    expect(body).not.toHaveProperty("error");
    expect(body).not.toHaveProperty("message");
    expect(typeof body.authenticated).toBe("boolean");
    expect(typeof body.status).toBe("string");
  });

  test("returns degraded session with 502 when adapter throws UpstreamError", async () => {
    fetchRailsSession.mockRejectedValueOnce(
      new Error("The upstream data provider returned an error.")
    );

    const { GET } = await import("@/app/api/auth/session/route");
    const response = await GET(new Request("http://localhost:3000/api/auth/session"));

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.authenticated).toBe(false);
    expect(body.status).toBe("degraded");
    expect(body.user).toBeNull();
    expect(body.capabilities.google_oauth).toBe(false);
    expect(body.capabilities.write_auth_enabled).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Non-cached / private semantics
  // -------------------------------------------------------------------------

  test("response has Cache-Control: private, no-store on success", async () => {
    fetchRailsSession.mockResolvedValueOnce(STANDARD_SESSION);

    const { GET } = await import("@/app/api/auth/session/route");
    const response = await GET(new Request("http://localhost:3000/api/auth/session"));

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  test("response has Cache-Control: private, no-store on degraded", async () => {
    fetchRailsSession.mockRejectedValueOnce(new Error("fail"));

    const { GET } = await import("@/app/api/auth/session/route");
    const response = await GET(new Request("http://localhost:3000/api/auth/session"));

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  test("response has Content-Type: application/json", async () => {
    fetchRailsSession.mockResolvedValueOnce(STANDARD_SESSION);

    const { GET } = await import("@/app/api/auth/session/route");
    const response = await GET(new Request("http://localhost:3000/api/auth/session"));

    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  test("response has Content-Type: application/json on degraded", async () => {
    fetchRailsSession.mockRejectedValueOnce(new Error("fail"));

    const { GET } = await import("@/app/api/auth/session/route");
    const response = await GET(new Request("http://localhost:3000/api/auth/session"));

    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  // -------------------------------------------------------------------------
  // Exports: dynamic vs revalidate
  // -------------------------------------------------------------------------

  test("exports dynamic = 'force-dynamic', not revalidate = 60", async () => {
    const mod = await import("@/app/api/auth/session/route");

    expect(mod.dynamic).toBe("force-dynamic");
    // Should NOT export revalidate = 60 like public data routes
    expect((mod as Record<string, unknown>).revalidate).toBeUndefined();
  });
});
