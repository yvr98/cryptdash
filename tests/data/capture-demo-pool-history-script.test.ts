import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  captureSnapshot,
  isRetryableNetworkError,
  isTimeoutError,
  main,
} from "../../scripts/capture-demo-pool-history.mjs";

const REAL_SET_TIMEOUT = globalThis.setTimeout;
type TimeoutHandler = Parameters<typeof setTimeout>[0];

const ORIGINAL_ENV = {
  RAILS_BASE_URL: process.env.RAILS_BASE_URL,
  INTERNAL_SNAPSHOT_CAPTURE_SECRET: process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET,
};

const BASE_METRICS = {
  liquidityUsd: 12345,
  volume24hUsd: 6789,
  transactions24h: 42,
};

beforeEach(() => {
  process.env.RAILS_BASE_URL = "https://rails.example.com";
  process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET = "test-secret";
});

afterEach(() => {
  vi.restoreAllMocks();

  if (ORIGINAL_ENV.RAILS_BASE_URL === undefined) {
    delete process.env.RAILS_BASE_URL;
  } else {
    process.env.RAILS_BASE_URL = ORIGINAL_ENV.RAILS_BASE_URL;
  }

  if (ORIGINAL_ENV.INTERNAL_SNAPSHOT_CAPTURE_SECRET === undefined) {
    delete process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET;
  } else {
    process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET = ORIGINAL_ENV.INTERNAL_SNAPSHOT_CAPTURE_SECRET;
  }
});

describe("capture-demo-pool-history script", () => {
  test("classifies timeout and transient network errors as retryable", () => {
    expect(isTimeoutError(new DOMException("timed out", "TimeoutError"))).toBe(true);
    expect(isRetryableNetworkError(new DOMException("timed out", "TimeoutError"))).toBe(true);
    expect(isRetryableNetworkError(new TypeError("fetch failed"))).toBe(true);
    expect(isRetryableNetworkError(new Error("boom"))).toBe(false);
  });

  test("retries a transient Rails timeout and succeeds on the next attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("The operation was aborted due to timeout", "TimeoutError"))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "created", captured_at: "2026-04-24T00:00:00Z" }),
      });

    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((handler: TimeoutHandler) => {
      if (typeof handler === "function") {
        handler();
      }

      return REAL_SET_TIMEOUT(() => {}, 0);
    }) as typeof setTimeout);

    await expect(captureSnapshot(BASE_METRICS)).resolves.toEqual({
      status: "created",
      captured_at: "2026-04-24T00:00:00Z",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("fails with a stage-specific error when Rails capture exhausts retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              attributes: {
                reserve_in_usd: "1000",
                volume_usd: { h24: "250" },
                transactions: { h24: { buys: 4, sells: 5 } },
              },
            },
          }),
      })
      .mockRejectedValueOnce(new DOMException("The operation was aborted due to timeout", "TimeoutError"))
      .mockRejectedValueOnce(new DOMException("The operation was aborted due to timeout", "TimeoutError"));

    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((handler: TimeoutHandler) => {
      if (typeof handler === "function") {
        handler();
      }

      return REAL_SET_TIMEOUT(() => {}, 0);
    }) as typeof setTimeout);

    await expect(main()).rejects.toThrow(
      /rails_capture: TimeoutError: The operation was aborted due to timeout/
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
