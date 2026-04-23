// =============================================================================
// CryptDash — Route Caching Test
// =============================================================================
//
// Verifies that route handlers export correct revalidation values and
// that response helpers produce the required Cache-Control headers.
//
// Frozen cache defaults from plan:
//   - route handler revalidate = 60
//   - Cache-Control: public, s-maxage=60, stale-while-revalidate=120
// =============================================================================

import { describe, it, expect } from "vitest";

import {
  CACHE_REVALIDATE,
  CACHE_HEADERS,
  jsonResponse,
  errorResponse,
} from "@/lib/api/cache";

// Import revalidate exports from route handlers
import * as searchRoute from "@/app/api/search/route";
import * as tokenRoute from "@/app/api/token/[coinId]/route";
import * as ohlcvRoute from "@/app/api/token/[coinId]/ohlcv/route";
import * as poolsRoute from "@/app/api/token/[coinId]/pools/route";

describe("route handler caching behavior", () => {
  it("CACHE_REVALIDATE constant is 60 seconds", () => {
    expect(CACHE_REVALIDATE).toBe(60);
  });

  it("CACHE_HEADERS contains correct Cache-Control value", () => {
    expect(CACHE_HEADERS["Cache-Control"]).toBe(
      "public, s-maxage=60, stale-while-revalidate=120"
    );
  });

  // Route handler revalidate exports
  const routeModules = [
    { name: "search", mod: searchRoute },
    { name: "token detail", mod: tokenRoute },
    { name: "ohlcv", mod: ohlcvRoute },
    { name: "pools", mod: poolsRoute },
  ];

  for (const { name, mod } of routeModules) {
    it(`${name} route exports revalidate = 60`, () => {
      expect(mod.revalidate).toBe(60);
    });
  }

  it("jsonResponse includes Cache-Control header", () => {
    const res = jsonResponse({ test: true });
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=120"
    );
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.status).toBe(200);
  });

  it("jsonResponse accepts custom status code", () => {
    const res = jsonResponse({ created: true }, 201);
    expect(res.status).toBe(201);
  });

  it("errorResponse includes Cache-Control header", () => {
    const res = errorResponse("not found", 404);
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=120"
    );
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.status).toBe(404);
  });

  it("jsonResponse body contains JSON data", async () => {
    const res = jsonResponse({ candles: [1, 2, 3] });
    const body = await res.json();
    expect(body).toEqual({ candles: [1, 2, 3] });
  });

  it("errorResponse body contains error message", async () => {
    const res = errorResponse("Upstream failed", 502);
    const body = await res.json();
    expect(body).toEqual({ error: "Upstream failed" });
  });
});
