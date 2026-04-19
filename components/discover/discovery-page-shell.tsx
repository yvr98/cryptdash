import type {
  DiscoveryExplanatoryCopy,
  DiscoveryPageModel,
} from "@/lib/page-data/discovery";
import type { DataState } from "@/lib/page-data/token-detail";

import { DiscoveryTable } from "@/components/discover/discovery-table";

export type DiscoveryPageShellData = DiscoveryPageModel & {
  dataState: DataState;
  copy: DiscoveryExplanatoryCopy;
};

type DiscoveryPageShellProps = {
  data: DiscoveryPageShellData;
};


export function DiscoveryPageShell({ data }: DiscoveryPageShellProps) {

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8">
      <div className="w-full space-y-4 sm:space-y-5">
        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:rounded-2xl sm:p-5 md:p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
            Discover
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-3xl">
            {data.copy.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[color:var(--muted)] sm:text-base">
            {data.copy.description}
          </p>
        </section>

        {data.dataState.status === "upstream_error" && (
          <section
            data-testid="discover-upstream-error-banner"
            className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-amber-400">
              Discovery data partially unavailable
            </p>

            {data.dataState.errors.length > 0 ? (
              <div className="mt-2 space-y-1">
                {data.dataState.errors.map((error) => (
                  <p
                    key={`${error.source}-${error.category}`}
                    className="text-sm text-[color:var(--muted)]"
                  >
                    {error.userMessage}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Some upstream discovery results could not be loaded. Showing available data only.
              </p>
            )}

            <p className="mt-2 text-xs text-[color:var(--muted)]">
              Showing available discovery rows. Try refreshing in a moment.
            </p>
          </section>
        )}

        {!data.emptyState && (
          <DiscoveryTable
            rows={data.rows}
            totalSupported={data.totalSupported}
            capped={data.capped}
          />
        )}
      </div>
    </div>
  );
}
