import { DiscoveryPageShell } from "@/components/discover/discovery-page-shell";
import { getDiscoveryPageData } from "@/lib/page-data/discovery";

export default async function DiscoverPage() {
  const data = await getDiscoveryPageData();

  return (
    <main className="flex flex-1">
      <DiscoveryPageShell data={data} />
    </main>
  );
}
