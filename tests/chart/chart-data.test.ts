// =============================================================================
// CryptDash — Chart Data Test
// =============================================================================
//
// Spec name (from plan): "returns fallback chart state for empty ohlcv response"
//
// Tests the chart selection helper, chart-data fallback state, and empty-chart UI
// without relying on live GeckoTerminal responses.
// =============================================================================

import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

const lightweightChartsMocks = vi.hoisted(() => {
  const setData = vi.fn();
  const addSeries = vi.fn(() => ({ setData }));
  const fitContent = vi.fn();
  const applyOptions = vi.fn();
  const remove = vi.fn();
  const createChart = vi.fn(() => ({
    addSeries,
    timeScale: () => ({ fitContent }),
    applyOptions,
    remove,
  }));

  return {
    setData,
    addSeries,
    fitContent,
    applyOptions,
    remove,
    createChart,
    candlestickSeries: Symbol("CandlestickSeries"),
  };
});

vi.mock("lightweight-charts", () => ({
  CandlestickSeries: lightweightChartsMocks.candlestickSeries,
  ColorType: { Solid: "solid" },
  CrosshairMode: { MagnetOHLC: 3 },
  createChart: lightweightChartsMocks.createChart,
}));

import { TokenChart } from "@/components/token/chart";
import { buildTokenChartState, toCandlestickSeriesData } from "@/lib/chart/chart-data";
import { selectDefaultChartMarket } from "@/lib/chart/select-market";
import { recommend } from "@/lib/recommendation/recommend";
import { descendingCandles, duplicateTimestampCandles, emptyOhlcvResponse, validCandles } from "@/tests/fixtures/ohlcv";
import { clearWinnerPools, nearTiePools } from "@/tests/fixtures/recommendation";

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
}

function stubChartBrowserApis() {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  lightweightChartsMocks.setData.mockReset();
  lightweightChartsMocks.addSeries.mockClear();
  lightweightChartsMocks.fitContent.mockClear();
  lightweightChartsMocks.applyOptions.mockClear();
  lightweightChartsMocks.remove.mockClear();
  lightweightChartsMocks.createChart.mockClear();
});

describe("returns fallback chart state for empty ohlcv response", () => {
  it("returns empty candles array when ohlcv_list is empty", () => {
    const state = buildTokenChartState([]);

    expect(emptyOhlcvResponse).toEqual([]);
    expect(state.status).toBe("empty");
    expect(state.candles).toEqual([]);
    expect(state.seriesData).toEqual([]);
  });

  it("returns fallback state object instead of throwing", () => {
    expect(() => buildTokenChartState([])).not.toThrow();

    const state = buildTokenChartState([]);

    expect(state.status).toBe("empty");
    expect(state.latest).toBeNull();
    expect(state.message).toMatch(/unavailable or insufficient/i);
  });

  it("chart component renders fallback UI for empty data", async () => {
    const market = selectDefaultChartMarket(recommend(clearWinnerPools), clearWinnerPools);

    stubChartBrowserApis();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ candles: [] }),
      })
    );

    render(createElement(TokenChart, { coinId: "ethereum", market }));

    await waitFor(() => {
      expect(screen.getByText("Chart unavailable")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/OHLCV data is unavailable or insufficient/i)
    ).toBeInTheDocument();
    expect(lightweightChartsMocks.createChart).not.toHaveBeenCalled();
  });
});

describe("TokenChart ready state", () => {
  it("renders ready chart state for valid candles and passes transformed data to lightweight-charts", async () => {
    const market = selectDefaultChartMarket(recommend(clearWinnerPools), clearWinnerPools);

    stubChartBrowserApis();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candles: validCandles }),
    });

    vi.stubGlobal("fetch", fetchMock);

    render(createElement(TokenChart, { coinId: "ethereum", market }));

    await waitFor(() => {
      expect(screen.getByText(/^Close/)).toBeInTheDocument();
    });

    expect(screen.getByText(`${validCandles.length} candles`)).toBeInTheDocument();
    expect(screen.getByText("Suggested market")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/token/ethereum/ohlcv?network=eth&pool=0x1111111111111111111111111111111111111111&timeframe=hour&limit=168",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(lightweightChartsMocks.createChart).toHaveBeenCalledTimes(1);
    expect(lightweightChartsMocks.addSeries).toHaveBeenCalledWith(
      lightweightChartsMocks.candlestickSeries,
      expect.objectContaining({ borderVisible: false })
    );
    expect(lightweightChartsMocks.setData).toHaveBeenCalledWith(
      toCandlestickSeriesData(validCandles)
    );
  });
});

describe("selectDefaultChartMarket", () => {
  it("prefers the recommendation winner when one exists", () => {
    const recommendation = recommend(nearTiePools);
    const market = selectDefaultChartMarket(recommendation, recommendation.eligiblePools);

    expect(market?.poolAddress).toBe(recommendation.winner?.poolAddress);
    expect(market?.selectionReason).toBe("recommended");
  });

  it("falls back to the highest-liquidity eligible pool when no winner exists", () => {
    const fallbackPools = [clearWinnerPools[1]!, clearWinnerPools[0]!];
    const recommendation = {
      ...recommend([clearWinnerPools[1]!]),
      winner: undefined,
    };
    const market = selectDefaultChartMarket(recommendation, fallbackPools);

    expect(market?.poolAddress).toBe(clearWinnerPools[0]!.poolAddress);
    expect(market?.selectionReason).toBe("highest_liquidity");
  });

  it("returns null when no eligible market exists", () => {
    const market = selectDefaultChartMarket(recommend([]), []);

    expect(market).toBeNull();
  });
});

describe("normalizes descending candle order to ascending", () => {
  it("sorts descending-order candles into ascending chronological order", () => {
    const state = buildTokenChartState(descendingCandles);

    expect(state.status).toBe("ready");
    expect(state.candles).toEqual(validCandles);
  });

  it("sets latest to the chronologically last candle after sorting", () => {
    const state = buildTokenChartState(descendingCandles);

    expect(state.latest.time).toBe(1700007200);
    expect(state.latest.close).toBe(3540);
  });

  it("produces ascending seriesData for lightweight-charts", () => {
    const state = buildTokenChartState(descendingCandles);
    const times = state.seriesData.map((d) => d.time);

    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]!);
    }
  });

  it("already-ascending candles remain unchanged", () => {
    const state = buildTokenChartState(validCandles);

    expect(state.candles).toEqual(validCandles);
    expect(state.latest.time).toBe(1700007200);
  });
});

describe("chart data fixtures", () => {
  it("fixture: validCandles can serve as non-empty chart data", () => {
    expect(validCandles.length).toBeGreaterThan(0);

    for (const candle of validCandles) {
      expect(candle.time).toBeTypeOf("number");
      expect(candle.open).toBeTypeOf("number");
      expect(candle.high).toBeTypeOf("number");
      expect(candle.low).toBeTypeOf("number");
      expect(candle.close).toBeTypeOf("number");
    }
  });
});

describe("deduplicates candles with identical timestamps", () => {
  it("removes duplicate timestamps keeping unique entries", () => {
    const state = buildTokenChartState(duplicateTimestampCandles);

    expect(state.status).toBe("ready");
    // 4 input candles with 1 duplicate pair → 3 unique timestamps
    expect(state.candles).toHaveLength(3);

    const times = state.candles.map((c) => c.time);
    const uniqueTimes = new Set(times);
    expect(uniqueTimes.size).toBe(times.length);
  });

  it("produces strictly ascending seriesData after dedup", () => {
    const state = buildTokenChartState(duplicateTimestampCandles);
    const times = state.seriesData.map((d) => d.time);

    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]!);
    }
  });

  it("keeps the last candle for each duplicate timestamp", () => {
    const state = buildTokenChartState(duplicateTimestampCandles);
    const dupeCandle = state.candles.find((c) => c.time === 1700003600);

    // The second occurrence (close: 3515) should be kept
    expect(dupeCandle?.close).toBe(3515);
  });
});

describe("chart shows error fallback when OHLCV request times out", () => {
  it("renders Chart unavailable after fetch exceeds timeout", async () => {
    const market = selectDefaultChartMarket(recommend(clearWinnerPools), clearWinnerPools);

    stubChartBrowserApis();
    vi.useFakeTimers();

    try {
      // Mock fetch that never resolves on its own but reacts to abort signal
      vi.stubGlobal(
        "fetch",
        (_url: string, options: { signal?: AbortSignal }) =>
          new Promise<never>((_, reject) => {
            options.signal?.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          })
      );

      render(createElement(TokenChart, { coinId: "ethereum", market }));

      // Should show loading state initially
      expect(screen.getByText("Loading chart data…")).toBeInTheDocument();

      // Advance past the 15-second client-side timeout
      await act(async () => {
        vi.advanceTimersByTime(15_000);
      });

      // After timeout, loading should be replaced by error fallback
      expect(screen.getByText("Chart unavailable")).toBeInTheDocument();
      expect(
        screen.getByText(/Chart data is temporarily unavailable/)
      ).toBeInTheDocument();
      expect(lightweightChartsMocks.createChart).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
