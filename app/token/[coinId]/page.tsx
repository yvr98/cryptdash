import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TokenDetailShell } from "@/components/token/token-detail-shell";
import { getTokenDetailPageData } from "@/lib/page-data/token-detail";
import { isUpstreamError } from "@/lib/api/upstream-error";
import { buildTokenMetadata } from "@/lib/page-data/metadata";

type TokenDetailPageProps = {
  params: Promise<{
    coinId: string;
  }>;
};

export async function generateMetadata({
  params,
}: TokenDetailPageProps): Promise<Metadata> {
  const { coinId } = await params;

  try {
    const data = await loadTokenDetailPageData(coinId);

    return buildTokenMetadata({
      coinId,
      name: data.token.name,
      symbol: data.token.symbol,
    });
  } catch (error) {
    // notFound() throws with digest NEXT_NOT_FOUND — must propagate
    // so Next.js renders the 404 page for true not-found cases
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      (error as { digest: unknown }).digest === "NEXT_NOT_FOUND"
    ) {
      throw error;
    }

    // Unexpected errors: safe fallback metadata rather than crashing
    return buildTokenMetadata({ coinId, name: coinId, symbol: "" });
  }
}

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
