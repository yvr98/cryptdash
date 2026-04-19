import { DiscoveryPageShell } from "@/components/discover/discovery-page-shell";
import {
  getDiscoveryPageData,
  getFixtureFetcher,
} from "@/lib/page-data/discovery";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string }>;
}) {
  const resolved = await searchParams;
  const fixture = resolved?.fixture;
  const fetcher = fixture ? getFixtureFetcher(fixture) : undefined;
  const data = await getDiscoveryPageData(fetcher);

  return (
    <main className="flex flex-1">
      <DiscoveryPageShell data={data} />
    </main>
  );
}
