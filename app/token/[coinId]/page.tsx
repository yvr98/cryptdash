import { notFound } from "next/navigation";

import { TokenDetailShell } from "@/components/token/token-detail-shell";
import { getTokenDetailPageData } from "@/lib/page-data/token-detail";
import { isUpstreamError } from "@/lib/api/upstream-error";

type TokenDetailPageProps = {
  params: Promise<{
    coinId: string;
  }>;
};

async function loadTokenDetailPageData(coinId: string) {
  try {
    return await getTokenDetailPageData(coinId);
  } catch (error) {
    if (isUpstreamError(error) && error.category === "not_found") {
      notFound();
    }

    throw error;
  }
}

export default async function TokenDetailPage({
  params,
}: TokenDetailPageProps) {
  const { coinId } = await params;
  const data = await loadTokenDetailPageData(coinId);

  return (
    <main className="flex flex-1">
      <TokenDetailShell data={data} />
    </main>
  );
}
