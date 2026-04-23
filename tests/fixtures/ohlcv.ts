// =============================================================================
// CryptDash — OHLCV Candle Fixtures
// =============================================================================
//
// Deterministic fixture data for OHLCV normalization and chart tests.
// Covers: valid candles, empty response, partial data, string-raw payloads.
//
// Legacy GeckoTerminal returned ohlcv_list as string arrays:
//   [timestamp, open, high, low, close, volume]
// CoinGecko onchain now returns the same rows as numbers.
// Adapters parse either shape into numeric Candle shapes.
// =============================================================================

import type { Candle } from "@/lib/types";

// ---------------------------------------------------------------------------
// Valid numeric candles (already normalized)
// ---------------------------------------------------------------------------

export const validCandles: Candle[] = [
  { time: 1700000000, open: 3450, high: 3500, low: 3440, close: 3490, volume: 1200 },
  { time: 1700003600, open: 3490, high: 3520, low: 3480, close: 3510, volume: 980 },
  { time: 1700007200, open: 3510, high: 3550, low: 3500, close: 3540, volume: 1100 },
];

// ---------------------------------------------------------------------------
// Raw legacy OHLCV strings (before adapter normalization)
// ---------------------------------------------------------------------------

export const rawOhlcvStrings: string[][] = [
  ["1700000000", "3450.5", "3500.2", "3440.1", "3490.8", "1200.3"],
  ["1700003600", "3490.8", "3520.4", "3480.0", "3510.6", "980.7"],
  ["1700007200", "3510.6", "3550.0", "3500.3", "3540.1", "1100.5"],
];

export const rawOhlcvNumbers: number[][] = [
  [1700000000, 3450.5, 3500.2, 3440.1, 3490.8, 1200.3],
  [1700003600, 3490.8, 3520.4, 3480.0, 3510.6, 980.7],
  [1700007200, 3510.6, 3550.0, 3500.3, 3540.1, 1100.5],
];

// ---------------------------------------------------------------------------
// Expected normalized candles from rawOhlcvStrings
// ---------------------------------------------------------------------------

export const expectedNormalizedCandles: Candle[] = [
  { time: 1700000000, open: 3450.5, high: 3500.2, low: 3440.1, close: 3490.8, volume: 1200.3 },
  { time: 1700003600, open: 3490.8, high: 3520.4, low: 3480, close: 3510.6, volume: 980.7 },
  { time: 1700007200, open: 3510.6, high: 3550, low: 3500.3, close: 3540.1, volume: 1100.5 },
];

// ---------------------------------------------------------------------------
// Empty OHLCV response (missing data scenario)
// ---------------------------------------------------------------------------

export const emptyOhlcvResponse: string[][] = [];

// ---------------------------------------------------------------------------
// Partial OHLCV with null fields (adapter must handle gracefully)
// ---------------------------------------------------------------------------

export const partialOhlcvWithNulls: (string | null)[][] = [
  ["1700000000", "3450.5", null, "3440.1", "3490.8", "1200.3"],
  ["1700003600", null, "3520.4", "3480.0", null, "980.7"],
];

// ---------------------------------------------------------------------------
// Descending-order candles (simulates upstream newest-first delivery)
// ---------------------------------------------------------------------------

export const descendingCandles: Candle[] = [
  { time: 1700007200, open: 3510, high: 3550, low: 3500, close: 3540, volume: 1100 },
  { time: 1700003600, open: 3490, high: 3520, low: 3480, close: 3510, volume: 980 },
  { time: 1700000000, open: 3450, high: 3500, low: 3440, close: 3490, volume: 1200 },
];

// ---------------------------------------------------------------------------
// Duplicate-timestamp candles (GeckoTerminal sometimes returns duplicates)
// ---------------------------------------------------------------------------

export const duplicateTimestampCandles: Candle[] = [
  { time: 1700000000, open: 3450, high: 3500, low: 3440, close: 3490, volume: 1200 },
  { time: 1700003600, open: 3490, high: 3520, low: 3480, close: 3510, volume: 980 },
  { time: 1700003600, open: 3495, high: 3525, low: 3485, close: 3515, volume: 990 },
  { time: 1700007200, open: 3510, high: 3550, low: 3500, close: 3540, volume: 1100 },
];
