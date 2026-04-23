// =============================================================================
// CryptDash — Pools Route Handler
// =============================================================================
//
// GET /api/token/[coinId]/pools?network=<network>&address=<contractAddress>
// Returns normalized PoolCandidate[] from GeckoTerminal.
// Revalidates every 60s with explicit Cache-Control header.
// =============================================================================

import { NextRequest } from "next/server";

import { fetchPoolsForToken } from "@/lib/api/geckoterminal";
import { jsonResponse, errorResponse, upstreamErrorResponse } from "@/lib/api/cache";
import { SUPPORTED_CHAINS } from "@/lib/constants/chains";

export const revalidate = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ coinId: string }> }
) {
  const { coinId } = await params;
  const network = request.nextUrl.searchParams.get("network");
  const contractAddress = request.nextUrl.searchParams.get("address");

  if (!coinId || !network || !contractAddress) {
    return errorResponse(
      "Missing required query params: network, address",
      400
    );
  }

  // Resolve chainId from GeckoTerminal network slug
  let chainId: import('@/lib/types').KnownChainId | undefined;
  for (const def of Object.values(SUPPORTED_CHAINS)) {
    if (def.geckoTerminalNetwork === network) {
      chainId = def.chainId;
      break;
    }
  }

  if (!chainId) {
    return errorResponse(`Unsupported network: ${network}`, 400);
  }

  try {
    const pools = await fetchPoolsForToken(
      network,
      chainId,
      contractAddress
    );
    return jsonResponse({ pools });
  } catch (err) {
    return upstreamErrorResponse(err, "Upstream pools failed");
  }
}
