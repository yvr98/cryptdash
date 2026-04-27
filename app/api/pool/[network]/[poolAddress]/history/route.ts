// =============================================================================
// CryptDash — Pool Market History Route Handler
// =============================================================================
//
// GET /api/pool/[network]/[poolAddress]/history
// Returns the latest normalized stored market history for one pool.
//
// This endpoint is intentionally no-store because the client polls it after
// the initial page render; caching an unavailable cold-start response would
// make the UI feel stuck.
// =============================================================================

import { NextRequest } from "next/server";

import { getPoolDetailHistory } from "@/lib/page-data/pool-detail";

export const dynamic = "force-dynamic";

const HISTORY_REFRESH_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store",
};

function historyResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...HISTORY_REFRESH_HEADERS,
    },
  });
}

function resolveE2EHistoryReader(historyTestState: string | null) {
  if (process.env.E2E_POOL_DETAIL_HISTORY_SEAM !== "enabled") {
    return undefined;
  }

  if (historyTestState !== "unavailable") {
    return undefined;
  }

  return async () => {
    throw new Error("Forced unavailable history for e2e verification");
  };
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      network: string;
      poolAddress: string;
    }>;
  },
) {
  const { network, poolAddress } = await params;

  if (!network || !poolAddress) {
    return historyResponse({ error: "Missing pool history route parameters" }, 400);
  }

  const history = await getPoolDetailHistory(
    network,
    poolAddress,
    resolveE2EHistoryReader(request.nextUrl.searchParams.get("historyTestState")),
  );
  return historyResponse(history);
}
