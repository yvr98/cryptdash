import { notFound } from "next/navigation";

import { TokenDetailShell } from "@/components/token/token-detail-shell";
import {
  getTokenDetailPageData,
  getTokenDetailFixtureFetchers,
} from "@/lib/page-data/token-detail";
import { isUpstreamError } from "@/lib/api/upstream-error";

type TokenDetailPageProps = {
  params: Promise<{
    coinId: string;
  }>;
  searchParams: Promise<{
    fixture?: string;
  }>;
};

async function loadTokenDetailPageData(coinId: string, fixture?: string) {
  try {
    const fixtureFetchers = fixture
      ? getTokenDetailFixtureFetchers(fixture)
      : undefined;

    return await getTokenDetailPageData(
      coinId,
      fixtureFetchers?.fetchCoinDetail,
      fixtureFetchers?.fetchPools
    );
  } catch (error) {
    if (isUpstreamError(error) && error.category === "not_found") {
      notFound();
    }

    throw error;
  }
}

export default async function TokenDetailPage({
  params,
  searchParams,
}: TokenDetailPageProps) {
  const { coinId } = await params;
  const resolvedSearchParams = await searchParams;
  const data = await loadTokenDetailPageData(coinId, resolvedSearchParams?.fixture);

  return (
    <main className="flex flex-1">
      <TokenDetailShell data={data} />
    </main>
  );
}
