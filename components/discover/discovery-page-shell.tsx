import type {
  DiscoveryEmptyState,
  DiscoveryPageModel,
} from "@/lib/page-data/discovery";
import type { DataState } from "@/lib/page-data/token-detail";

import { DiscoveryTable } from "@/components/discover/discovery-table";

export type DiscoveryPageShellData = DiscoveryPageModel & {
  dataState: DataState;
};

type DiscoveryPageShellProps = {
  data: DiscoveryPageShellData;
};

function getEmptyStateContent(emptyState: DiscoveryEmptyState) {
  if (emptyState.reason === "no_input") {
    return {
      title: "No discovery snapshot available",
      description:
        "The upstream discovery feed did not return any rows for this snapshot yet. Try again in a moment.",
    };
  }

  if (emptyState.hadUnsupportedRows) {
    return {
      title: "No supported-chain pools in this snapshot",
      description:
        "Upstream discovery returned pools, but none mapped to TokenScope's supported chains.",
    };
  }

  return {
    title: "No pools in this snapshot",
    description:
      "Upstream discovery returned an empty snapshot, so there are no supported pools to show right now.",
  };
}

export function DiscoveryPageShell({ data }: DiscoveryPageShellProps) {
  const emptyState = data.emptyState ? getEmptyStateContent(data.emptyState) : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-8">
      <div className="w-full space-y-4 sm:space-y-5">
        <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:rounded-2xl sm:p-5 md:p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
            Discover
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-3xl">
            Explore trending pools across supported chains
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[color:var(--muted)] sm:text-base">
            Discovery order is upstream-ranked. TokenScope keeps the original feed order, filters it to supported chains, and shows the latest available liquidity, volume, activity, and freshness signals.
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

        {emptyState ? (
          <section className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 sm:rounded-2xl sm:p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--muted)]">
              Discovery snapshot
            </p>
            <h2 className="mt-2 text-xl font-bold text-[color:var(--foreground)]">
              {emptyState.title}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              {emptyState.description}
            </p>
          </section>
        ) : (
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
