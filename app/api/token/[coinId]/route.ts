// =============================================================================
// TokenScope — Token Detail Route Handler
// =============================================================================
//
// GET /api/token/[coinId]
// Returns TokenDetail (token metadata + platform addresses) from CoinGecko.
// Revalidates every 60s with explicit Cache-Control header.
// =============================================================================

import { getCoinDetail } from "@/lib/api/coingecko";
import { jsonResponse, errorResponse, upstreamErrorResponse } from "@/lib/api/cache";

export const revalidate = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ coinId: string }> }
) {
  const { coinId } = await params;

  if (!coinId) {
    return errorResponse("Missing coinId", 400);
  }

  try {
    const detail = await getCoinDetail(coinId);
    return jsonResponse(detail);
  } catch (err) {
    return upstreamErrorResponse(err, "Upstream token detail failed");
  }
}
