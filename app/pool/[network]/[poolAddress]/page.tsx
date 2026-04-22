import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PoolDetailShell } from "@/components/pool/pool-detail-shell";
import { fetchPoolRecord } from "@/lib/api/geckoterminal";
import { isUpstreamError } from "@/lib/api/upstream-error";
import {
  getPoolDetailPageData,
  type PoolDetailPageDataSideEffects,
} from "@/lib/page-data/pool-detail";
import { buildPoolMetadata } from "@/lib/page-data/metadata";
type PoolDetailPageProps = {
  params: Promise<{
    network: string;
    poolAddress: string;
  }>;
  searchParams: Promise<{
    coinId?: string;
    historyTestState?: string;
  }>;
};

function resolveE2EPoolDetailSideEffects(
  historyTestState?: string,
): PoolDetailPageDataSideEffects | undefined {
  if (process.env.E2E_POOL_DETAIL_HISTORY_SEAM !== "enabled") {
    return undefined;
  }

  if (historyTestState !== "unavailable") {
    return undefined;
  }

  return {
    readHistory: async () => {
      throw new Error("Forced unavailable history for e2e verification");
    },
  };
}

export async function generateMetadata({
  params,
}: PoolDetailPageProps): Promise<Metadata> {
  const { network, poolAddress } = await params;

  try {
    const pool = await fetchPoolRecord(network, poolAddress);

    return buildPoolMetadata({
      network,
      poolAddress,
      pairLabel: pool.pairLabel || undefined,
      dexName: pool.dexName || undefined,
    });
  } catch (error) {
    if (isUpstreamError(error) && error.category === "not_found") {
      notFound();
    }

    return buildPoolMetadata({
      network,
      poolAddress,
    });
  }
}

async function loadPoolDetailPageData(
  network: string,
  poolAddress: string,
  coinId?: string,
  historyTestState?: string,
) {
  try {
    const sideEffects = resolveE2EPoolDetailSideEffects(historyTestState);

    return await getPoolDetailPageData(
      network,
      poolAddress,
      coinId,
      undefined,
      undefined,
      sideEffects,
    );
  } catch (error) {
    if (isUpstreamError(error) && error.category === "not_found") {
      notFound();
    }

    throw error;
  }
}

export default async function PoolDetailPage({
  params,
  searchParams,
}: PoolDetailPageProps) {
  const { network, poolAddress } = await params;
  const { coinId, historyTestState } = await searchParams;

  const data = await loadPoolDetailPageData(
    network,
    poolAddress,
    coinId,
    historyTestState,
  );

  return (
    <main className="flex flex-1">
      <PoolDetailShell data={data} />
    </main>
  );
}
