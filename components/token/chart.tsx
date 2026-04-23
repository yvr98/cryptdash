"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
} from "lightweight-charts";

import type { Candle } from "@/lib/types";
import type { ChartMarket } from "@/lib/chart/select-market";
import {
  EMPTY_CHART_MESSAGE,
  buildTokenChartState,
} from "@/lib/chart/chart-data";

type TokenChartProps = {
  coinId: string;
  market: ChartMarket | null;
};

type OhlcvRouteResponse = {
  candles?: Candle[];
};

class ChartRequestTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChartRequestTimeoutError";
  }
}

const CHART_TIMEFRAME = "hour";
const CHART_LIMIT = 168;
const FETCH_TIMEOUT_MS = 15_000;
  const NO_MARKET_MESSAGE =
  "No eligible supported-chain market is available yet, so CryptDash cannot draw an hourly chart.";
  const ERROR_CHART_MESSAGE =
  "Chart data is temporarily unavailable for this market. Try again in a moment.";
function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 4,
  }).format(value);
}

function readToken(name: string, fallback: string) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  return value || fallback;
}

async function fetchChartResponse(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  controller: AbortController
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new ChartRequestTimeoutError(
          "Chart data request exceeded the client timeout window."
        )
      );
      controller.abort();
    }, timeoutMs);

  });

  try {
    return await Promise.race([
      fetch(input, { ...init, signal: controller.signal }),
      timeoutPromise,
    ]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

export function TokenChart({ coinId, market }: TokenChartProps) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(market));
  const [fallbackMessage, setFallbackMessage] = useState(
    market ? EMPTY_CHART_MESSAGE : NO_MARKET_MESSAGE
  );
  const [chartState, setChartState] = useState(() =>
    buildTokenChartState([], market ? EMPTY_CHART_MESSAGE : NO_MARKET_MESSAGE)
  );

  const selectionLabel = useMemo(() => {
    if (!market) {
      return "Waiting for an eligible market";
    }

    return market.selectionReason === "recommended"
      ? "Suggested market"
      : "Highest-liquidity fallback";
  }, [market]);

  useEffect(() => {
    if (!market) {
      setIsLoading(false);
      setFallbackMessage(NO_MARKET_MESSAGE);
      setChartState(buildTokenChartState([], NO_MARKET_MESSAGE));
      return;
    }

    const activeMarket = market;

    const controller = new AbortController();
    let isActive = true;
    async function loadChartData() {
      setIsLoading(true);

      try {
        const query = new URLSearchParams({
          network: activeMarket.network,
          pool: activeMarket.poolAddress,
          timeframe: CHART_TIMEFRAME,
          limit: String(CHART_LIMIT),
        });

        const response = await fetchChartResponse(
          `/api/token/${coinId}/ohlcv?${query.toString()}`,
          {
            cache: "no-store",
          },
          FETCH_TIMEOUT_MS,
          controller
        );

        if (!response.ok) {
          throw new Error(`OHLCV request failed: ${response.status}`);
        }

        const data = (await response.json()) as OhlcvRouteResponse;
        const nextState = buildTokenChartState(data.candles ?? []);

        if (!isActive) {
          return;
        }

        setChartState(nextState);
        setFallbackMessage(nextState.message ?? EMPTY_CHART_MESSAGE);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (error instanceof ChartRequestTimeoutError) {
          setChartState(buildTokenChartState([], ERROR_CHART_MESSAGE));
          setFallbackMessage(ERROR_CHART_MESSAGE);
          return;
        }

        if (controller.signal.aborted) {
          return;
        }

        setChartState(buildTokenChartState([], ERROR_CHART_MESSAGE));
        setFallbackMessage(
          error instanceof Error ? ERROR_CHART_MESSAGE : EMPTY_CHART_MESSAGE
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadChartData();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [coinId, market]);

  useLayoutEffect(() => {
    const container = chartContainerRef.current;

    if (!container || chartState.status !== "ready") {
      return;
    }

    const chart = createChart(container, {
      width: container.clientWidth,
      height: Math.min(container.clientHeight, 400),
      layout: {
        background: {
          type: ColorType.Solid,
          color: readToken("--surface-strong", "#ffffff"),
        },
        textColor: readToken("--muted", "#5c677b"),
      },
      grid: {
        vertLines: { color: readToken("--grid", "rgba(14, 23, 38, 0.06)") },
        horzLines: { color: readToken("--grid", "rgba(14, 23, 38, 0.06)") },
      },
      crosshair: {
        mode: CrosshairMode.MagnetOHLC,
      },
      rightPriceScale: {
        borderColor: readToken("--border", "rgba(14, 23, 38, 0.12)"),
      },
      timeScale: {
        borderColor: readToken("--border", "rgba(14, 23, 38, 0.12)"),
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: readToken("--up", "#22c55e"),
      downColor: readToken("--down", "#ef4444"),
      wickUpColor: readToken("--up", "#22c55e"),
      wickDownColor: readToken("--down", "#ef4444"),
      borderVisible: false,
    });

    series.setData(chartState.seriesData);
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      chart.applyOptions({ width: entry.contentRect.width });
      chart.timeScale().fitContent();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [chartState]);

  return (
    <section
      data-testid="token-ohlcv-chart"
      className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]"
    >
      <div className="p-4 sm:p-5 md:p-6">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
                Market chart
              </p>
              <h2 className="text-xl font-bold text-[color:var(--foreground)]">
                Hourly OHLCV
              </h2>
              <p className="text-sm text-[color:var(--muted)]">
                {market
                  ? `${market.pairLabel} on ${market.dexName} (${market.chainName})`
                  : NO_MARKET_MESSAGE}
              </p>
            </div>

            <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--muted)]">
              {CHART_LIMIT} candles
            </span>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] font-medium">
            <span className="rounded-md border border-[color:var(--accent)] bg-[color:var(--accent-soft)] px-2 py-0.5 text-[color:var(--accent)]">
              {selectionLabel}
            </span>
            {market ? (
              <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-0.5 text-[color:var(--muted)]">
                {market.dexName} · {market.chainName}
              </span>
            ) : null}
            <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-0.5 text-[color:var(--muted)]">
              1h
            </span>
          </div>

          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-2 sm:p-3 md:p-4">
            {isLoading ? (
              <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-[color:var(--border)] px-6 text-center text-sm text-[color:var(--muted)] sm:h-64 md:h-80">
                Loading chart data…
              </div>
            ) : chartState.status === "ready" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[color:var(--muted)]">
                  <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-0.5">
                    Close {formatUsd(chartState.latest.close)}
                  </span>
                  <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-0.5">
                    {chartState.candles.length} candles
                  </span>
                </div>
                <div
                  ref={chartContainerRef}
                  className="h-56 w-full overflow-hidden rounded-lg border border-[color:var(--border)] sm:h-64 md:h-80"
                />
              </div>
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[color:var(--border)] px-6 text-center sm:h-64 md:h-80">
                <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                  Chart unavailable
                </p>
                <p className="max-w-md text-sm text-[color:var(--muted)]">
                  {fallbackMessage}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
