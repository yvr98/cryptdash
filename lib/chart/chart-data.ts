import type { CandlestickData, UTCTimestamp } from "lightweight-charts";

import type { Candle } from "@/lib/types";

export const EMPTY_CHART_MESSAGE =
  "OHLCV data is unavailable or insufficient for this market right now.";

export interface TokenChartReadyState {
  status: "ready";
  candles: Candle[];
  latest: Candle;
  message: null;
  seriesData: CandlestickData[];
}

export interface TokenChartEmptyState {
  status: "empty";
  candles: [];
  latest: null;
  message: string;
  seriesData: [];
}

export type TokenChartState = TokenChartReadyState | TokenChartEmptyState;

export function toCandlestickSeriesData(candles: Candle[]): CandlestickData[] {
  return candles.map((candle) => ({
    time: candle.time as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

export function buildTokenChartState(
  candles: Candle[],
  emptyMessage: string = EMPTY_CHART_MESSAGE
): TokenChartState {
  if (candles.length === 0) {
    return {
      status: "empty",
      candles: [],
      latest: null,
      message: emptyMessage,
      seriesData: [],
    };
  }

  const sorted = [...candles].sort((a, b) => a.time - b.time);

  // Deduplicate — lightweight-charts requires strictly ascending timestamps.
  // GeckoTerminal occasionally returns duplicate timestamps; keep the last one.
  const deduped = sorted.filter(
    (candle, i) => i === sorted.length - 1 || candle.time !== sorted[i + 1]!.time
  );

  return {
    status: "ready",
    candles: deduped,
    latest: deduped[deduped.length - 1]!,
    message: null,
    seriesData: toCandlestickSeriesData(deduped),
  };
}
