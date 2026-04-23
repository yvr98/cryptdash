// =============================================================================
// CryptDash — OHLCV Normalization Test
// =============================================================================
//
// Spec name (from plan): "normalizes GeckoTerminal OHLCV payload strings into numeric candles"
//
// Tests the normalizeOhlcv function from lib/api/geckoterminal.ts
// which parses raw GeckoTerminal ohlcv_list string arrays into numeric Candles.
// =============================================================================

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  rawOhlcvStrings,
  rawOhlcvNumbers,
  expectedNormalizedCandles,
  emptyOhlcvResponse,
  partialOhlcvWithNulls,
  validCandles,
} from "@/tests/fixtures/ohlcv";

import { fetchOhlcv, normalizeOhlcv } from "@/lib/api/geckoterminal";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("normalizes upstream OHLCV payloads into numeric candles", () => {
  it("parses valid raw string arrays into numeric Candle objects", () => {
    const candles = normalizeOhlcv(rawOhlcvStrings);

    expect(candles).toHaveLength(rawOhlcvStrings.length);
    for (const c of candles) {
      expect(c.time).toBeTypeOf("number");
      expect(c.open).toBeTypeOf("number");
      expect(c.high).toBeTypeOf("number");
      expect(c.low).toBeTypeOf("number");
      expect(c.close).toBeTypeOf("number");
      expect(c.volume).toBeTypeOf("number");
    }
  });

  it("produces candles matching expectedNormalizedCandles fixture", () => {
    const candles = normalizeOhlcv(rawOhlcvStrings);
    expect(candles).toEqual(expectedNormalizedCandles);
  });

  it("parses numeric onchain OHLCV rows into Candle objects", () => {
    const candles = normalizeOhlcv(rawOhlcvNumbers);
    expect(candles).toEqual(expectedNormalizedCandles);
  });

  it("returns empty array for empty ohlcv_list", () => {
    const candles = normalizeOhlcv(emptyOhlcvResponse);
    expect(candles).toEqual([]);
  });

  it("handles null fields in raw data gracefully by skipping bad rows", () => {
    const candles = normalizeOhlcv(partialOhlcvWithNulls);
    // Both rows in partialOhlcvWithNulls have null OHLC fields, so both are skipped
    expect(candles).toHaveLength(0);
  });

  it("skips rows with fewer than 5 elements", () => {
    const shortRows = [["1700000000", "100", "200"]];
    const candles = normalizeOhlcv(shortRows as string[][]);
    expect(candles).toHaveLength(0);
  });

  it("preserves volume when present but omits it when null", () => {
    const withVolume: (string | null)[][] = [
      ["1700000000", "100", "200", "50", "150", "500"],
    ];
    const withoutVolume: (string | null)[][] = [
      ["1700000000", "100", "200", "50", "150", null],
    ];

    const volCandles = normalizeOhlcv(withVolume);
    expect(volCandles[0].volume).toBe(500);

    const noVolCandles = normalizeOhlcv(withoutVolume);
    expect(noVolCandles[0].volume).toBeUndefined();
  });

  // Fixture validation tests (kept from scaffold)
  it("fixture: rawOhlcvStrings has matching length to expectedNormalizedCandles", () => {
    expect(rawOhlcvStrings).toHaveLength(expectedNormalizedCandles.length);
  });

  it("fixture: validCandles have strictly increasing timestamps", () => {
    for (let i = 1; i < validCandles.length; i++) {
      expect(validCandles[i].time).toBeGreaterThan(validCandles[i - 1].time);
    }
  });

  it("fixture: each valid candle has high >= low", () => {
    for (const c of validCandles) {
      expect(c.high).toBeGreaterThanOrEqual(c.low);
    }
  });

  it("fixture: emptyOhlcvResponse is an empty array", () => {
    expect(emptyOhlcvResponse).toEqual([]);
  });

  it("fixture: partialOhlcvWithNulls contains null values", () => {
    const hasNull = partialOhlcvWithNulls.some((row) =>
      row.some((v) => v === null)
    );
    expect(hasNull).toBe(true);
  });
});

describe("fetchOhlcv", () => {
  it("calls CoinGecko onchain OHLCV endpoint for the given pool address", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          attributes: {
            ohlcv_list: rawOhlcvNumbers,
          },
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("COINGECKO_API_KEY", "test-demo-key");

    const candles = await fetchOhlcv(
      "eth",
      "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
      "hour",
      5
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.coingecko.com/api/v3/onchain/networks/eth/pools/0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640/ohlcv/hour?limit=5",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
          "x-cg-demo-api-key": "test-demo-key",
        }),
      })
    );
    expect(candles).toEqual(expectedNormalizedCandles);
  });

  it("omits the demo API key header when COINGECKO_API_KEY is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          attributes: {
            ohlcv_list: rawOhlcvNumbers,
          },
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("COINGECKO_API_KEY", "");

    await fetchOhlcv(
      "eth",
      "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
      "hour",
      5
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.coingecko.com/api/v3/onchain/networks/eth/pools/0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640/ohlcv/hour?limit=5",
      expect.objectContaining({
        headers: expect.not.objectContaining({
          "x-cg-demo-api-key": expect.any(String),
        }),
      })
    );
  });
});
