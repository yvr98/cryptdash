import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PoolDetailShell } from "@/components/pool/pool-detail-shell";
import { isUpstreamError } from "@/lib/api/upstream-error";
import { getPoolDetailPageData } from "@/lib/page-data/pool-detail";
import { buildPoolMetadata } from "@/lib/page-data/metadata";
type PoolDetailPageProps = {
  params: Promise<{
    network: string;
    poolAddress: string;
  }>;
  searchParams: Promise<{
    coinId?: string;
  }>;
};

export async function generateMetadata({
  params,
}: PoolDetailPageProps): Promise<Metadata> {
  const { network, poolAddress } = await params;
  const data = await loadPoolDetailPageData(network, poolAddress);

  return buildPoolMetadata({
    network,
    poolAddress,
    pairLabel: data.pool.pairLabel || undefined,
    dexName: data.pool.dexName || undefined,
  });
}

async function loadPoolDetailPageData(
  network: string,
  poolAddress: string,
  coinId?: string,
) {
  try {
    return await getPoolDetailPageData(
      network,
      poolAddress,
      coinId,
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
  const { coinId } = await searchParams;

  const data = await loadPoolDetailPageData(
    network,
    poolAddress,
    coinId,
  );

  return (
    <main className="flex flex-1">
      <PoolDetailShell data={data} />
    </main>
  );
}
