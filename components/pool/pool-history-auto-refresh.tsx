"use client";

import { useEffect, useState } from "react";

import {
  PoolHistoryLoadingSection,
  PoolHistorySection,
} from "@/components/pool/pool-detail-shell";
import type { PoolDetailHistory } from "@/lib/page-data/pool-detail";

const HISTORY_REFRESH_INTERVAL_MS = 10_000;
const MAX_HISTORY_REFRESH_ATTEMPTS = 12;

type RefreshStatus = "loading" | "checking" | "ready" | "stopped";

type PoolHistoryAutoRefreshProps = {
  network: string;
  poolAddress: string;
  initialHistory: PoolDetailHistory;
  historyTestState?: string;
};

function buildHistoryApiPath(
  network: string,
  poolAddress: string,
  historyTestState?: string,
) {
  const path = `/api/pool/${encodeURIComponent(network)}/${encodeURIComponent(poolAddress)}/history`;

  if (!historyTestState) {
    return path;
  }

  return `${path}?historyTestState=${encodeURIComponent(historyTestState)}`;
}

export function PoolHistoryAutoRefresh({
  network,
  poolAddress,
  initialHistory,
  historyTestState,
}: PoolHistoryAutoRefreshProps) {
  const [history, setHistory] = useState(initialHistory);
  const [status, setStatus] = useState<RefreshStatus>(
    initialHistory.state === "ready" ? "ready" : "loading",
  );

  useEffect(() => {
    let isCancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function refreshHistory(attempt: number) {
      if (isCancelled) return;

      setStatus(attempt === 1 ? "loading" : "checking");

      try {
        const response = await fetch(
          buildHistoryApiPath(network, poolAddress, historyTestState),
          {
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          throw new Error(`History refresh failed: ${response.status}`);
        }

        const nextHistory = (await response.json()) as PoolDetailHistory;

        if (isCancelled) return;

        setHistory(nextHistory);

        if (nextHistory.state === "ready") {
          setStatus("ready");
          return;
        }
      } catch {
        if (isCancelled) return;
      }

      if (attempt >= MAX_HISTORY_REFRESH_ATTEMPTS) {
        setStatus("stopped");
        return;
      }

      setStatus("checking");
      timeoutId = setTimeout(() => {
        void refreshHistory(attempt + 1);
      }, HISTORY_REFRESH_INTERVAL_MS);
    }

    setHistory(initialHistory);

    if (initialHistory.state === "ready") {
      setStatus("ready");
      return () => {
        isCancelled = true;
      };
    }

    void refreshHistory(1);

    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [historyTestState, initialHistory, network, poolAddress]);

  if (status === "loading") {
    return <PoolHistoryLoadingSection />;
  }

  return (
    <div className="space-y-2">
      <PoolHistorySection history={history} />
      {history.state !== "ready" && status === "checking" && (
        <p className="px-1 text-xs text-[color:var(--muted)]">
          Checking for stored history updates automatically.
        </p>
      )}
      {history.state !== "ready" && status === "stopped" && (
        <p className="px-1 text-xs text-[color:var(--muted)]">
          Still waiting on stored history. This section will update on your next visit.
        </p>
      )}
    </div>
  );
}
