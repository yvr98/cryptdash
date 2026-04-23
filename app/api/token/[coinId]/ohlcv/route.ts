// =============================================================================
// CryptDash — OHLCV Route Handler
// =============================================================================
//
// GET /api/token/[coinId]/ohlcv?network=<network>&pool=<poolAddress>
// Returns normalized Candle[] from GeckoTerminal.
// Revalidates every 60s with explicit Cache-Control header.
// =============================================================================

import { NextRequest } from "next/server";

import { fetchOhlcv } from "@/lib/api/geckoterminal";
import { jsonResponse, errorResponse, upstreamErrorResponse } from "@/lib/api/cache";

export const revalidate = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ coinId: string }> }
) {
  const { coinId } = await params;
  const network = request.nextUrl.searchParams.get("network");
  const poolAddress = request.nextUrl.searchParams.get("pool");

  if (!coinId || !network || !poolAddress) {
    return errorResponse("Missing required query params: network, pool", 400);
  }

  const timeframe = request.nextUrl.searchParams.get("timeframe") ?? "hour";
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 168;

  if (!Number.isFinite(limit) || limit < 1 || limit > 1000) {
    return errorResponse("limit must be a number between 1 and 1000", 400);
  }

  try {
    const candles = await fetchOhlcv(network, poolAddress, timeframe, limit);
    return jsonResponse({ candles });
  } catch (err) {
    return upstreamErrorResponse(err, "Upstream OHLCV failed");
  }
}
