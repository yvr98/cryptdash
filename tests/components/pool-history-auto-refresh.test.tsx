import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PoolHistoryAutoRefresh } from "@/components/pool/pool-history-auto-refresh";
import type { PoolDetailHistory } from "@/lib/page-data/pool-detail";

const UNAVAILABLE_HISTORY: PoolDetailHistory = {
  state: "unavailable",
  cards: [
    { label: "Liquidity", state: "sparse", latestValue: null, delta: null, points: [] },
    { label: "24h Vol", state: "sparse", latestValue: null, delta: null, points: [] },
    { label: "24h Txs", state: "sparse", latestValue: null, delta: null, points: [] },
  ],
};

const READY_HISTORY: PoolDetailHistory = {
  state: "ready",
  cards: [
    {
      label: "Liquidity",
      state: "ready",
      latestValue: 5_000_000,
      delta: 250_000,
      points: [
        { timestamp: "2026-04-22T00:00:00.000Z", value: 4_750_000 },
        { timestamp: "2026-04-22T12:00:00.000Z", value: 4_900_000 },
        { timestamp: "2026-04-23T00:00:00.000Z", value: 5_000_000 },
      ],
    },
    {
      label: "24h Vol",
      state: "ready",
      latestValue: 500_000,
      delta: 50_000,
      points: [
        { timestamp: "2026-04-22T00:00:00.000Z", value: 450_000 },
        { timestamp: "2026-04-22T12:00:00.000Z", value: 475_000 },
        { timestamp: "2026-04-23T00:00:00.000Z", value: 500_000 },
      ],
    },
    {
      label: "24h Txs",
      state: "ready",
      latestValue: 1_240,
      delta: 140,
      points: [
        { timestamp: "2026-04-22T00:00:00.000Z", value: 1_100 },
        { timestamp: "2026-04-22T12:00:00.000Z", value: 1_180 },
        { timestamp: "2026-04-23T00:00:00.000Z", value: 1_240 },
      ],
    },
  ],
};

const SPARSE_HISTORY: PoolDetailHistory = {
  state: "sparse",
  cards: [
    { label: "Liquidity", state: "sparse", latestValue: null, delta: null, points: [] },
    { label: "24h Vol", state: "sparse", latestValue: null, delta: null, points: [] },
    { label: "24h Txs", state: "sparse", latestValue: null, delta: null, points: [] },
  ],
};

function createJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("PoolHistoryAutoRefresh", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads history after mount and updates the section without a page reload", async () => {
    fetchMock.mockResolvedValueOnce(createJsonResponse(READY_HISTORY));

    render(
      <PoolHistoryAutoRefresh
        network="base"
        poolAddress="0x6c561b446416e1a00e8e93e221854d6ea4171372"
        initialHistory={UNAVAILABLE_HISTORY}
      />,
    );

    expect(
      screen.getByText(/Preparing stored 24h history/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("+$250.0K")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/pool/base/0x6c561b446416e1a00e8e93e221854d6ea4171372/history",
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      },
    );
    expect(screen.getByText("$5.00M")).toBeInTheDocument();
    expect(screen.queryByText(/Preparing stored 24h history/i)).not.toBeInTheDocument();
  });

  it("keeps the loading state for non-ready refresh responses", async () => {
    fetchMock.mockResolvedValue(createJsonResponse(SPARSE_HISTORY));

    render(
      <PoolHistoryAutoRefresh
        network="base"
        poolAddress="0x6c561b446416e1a00e8e93e221854d6ea4171372"
        initialHistory={UNAVAILABLE_HISTORY}
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.getByText(/Preparing stored 24h history/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("History still building")).not.toBeInTheDocument();
  });
});
