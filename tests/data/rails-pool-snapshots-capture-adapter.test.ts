import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  capturePoolSnapshot,
  type CapturePoolSnapshotInput,
} from "@/lib/api/rails-pool-snapshots";
import {
  RAILS_INTERNAL_SNAPSHOT_CAPTURE_SECRET_HEADER,
  RAILS_INTERNAL_WRITE_REQUEST_TIMEOUT_MS,
} from "@/lib/api/rails-config";
import { UpstreamError, isUpstreamError } from "@/lib/api/upstream-error";

const ORIGINAL_ENV = process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function setNodeEnv(value: string | undefined): void {
  if (value === undefined) {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: undefined,
      configurable: true,
      enumerable: true,
      writable: true,
    });
    return;
  }

  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}

function buildInput(overrides: Partial<CapturePoolSnapshotInput> = {}): CapturePoolSnapshotInput {
  return {
    networkId: "ethereum",
    poolAddress: "0xAbCdEf1234567890",
    liquidityUsd: 12345.67,
    volume24hUsd: 456.78,
    transactions24h: 99,
    ...overrides,
  };
}

function mockFetchJson(payload: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(payload),
    })
  );
}

function mockFetchJsonError(status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    })
  );
}

function mockFetchNetworkError(error: Error): void {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
}

beforeEach(() => {
  process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET = "test-capture-secret";
  delete process.env.RAILS_BASE_URL;
});

afterEach(() => {
  vi.restoreAllMocks();

  if (ORIGINAL_ENV === undefined) {
    delete process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET;
  } else {
    process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET = ORIGINAL_ENV;
  }

  if (ORIGINAL_NODE_ENV === undefined) {
    setNodeEnv(undefined);
  } else {
    setNodeEnv(ORIGINAL_NODE_ENV);
  }
});

describe("capturePoolSnapshot — success outcomes", () => {
  test("returns created outcome with capturedAt for valid Rails response", async () => {
    mockFetchJson({
      status: "created",
      captured_at: "2026-04-22T12:00:00Z",
    }, 201);

    await expect(capturePoolSnapshot(buildInput())).resolves.toEqual({
      status: "created",
      capturedAt: "2026-04-22T12:00:00Z",
    });
  });

  test("returns throttled skip outcome for explicit skip response", async () => {
    mockFetchJson({ status: "skipped", reason: "throttled" }, 200);

    await expect(capturePoolSnapshot(buildInput())).resolves.toEqual({
      status: "skipped",
      reason: "throttled",
    });
  });

  test("returns no_metrics skip outcome for explicit skip response", async () => {
    mockFetchJson({ status: "skipped", reason: "no_metrics" }, 200);

    await expect(
      capturePoolSnapshot(
        buildInput({
          liquidityUsd: null,
          volume24hUsd: null,
          transactions24h: null,
        })
      )
    ).resolves.toEqual({
      status: "skipped",
      reason: "no_metrics",
    });
  });
});

describe("capturePoolSnapshot — request contract", () => {
  test("posts to the centralized capture path and sends only metric fields in the JSON body", async () => {
    mockFetchJson({
      status: "created",
      captured_at: "2026-04-22T12:00:00Z",
    }, 201);

    await capturePoolSnapshot(buildInput());

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toBe(
      "http://127.0.0.1:3001/api/v1/pools/ethereum/0xAbCdEf1234567890/snapshots/capture"
    );

    const options = fetchCall[1];
    expect(options.method).toBe("POST");
    expect(options.headers.Accept).toBe("application/json");
    expect(options.headers[RAILS_INTERNAL_SNAPSHOT_CAPTURE_SECRET_HEADER]).toBe(
      "test-capture-secret"
    );
    expect(JSON.parse(options.body)).toEqual({
      liquidity_usd: 12345.67,
      volume_24h_usd: 456.78,
      transactions_24h: 99,
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.signal.aborted).toBe(false);
    expect(RAILS_INTERNAL_WRITE_REQUEST_TIMEOUT_MS).toBe(5000);
  });

  test("omits null and undefined metrics instead of sending extra fields", async () => {
    mockFetchJson({ status: "skipped", reason: "no_metrics" }, 200);

    await capturePoolSnapshot(
      buildInput({
        liquidityUsd: null,
        volume24hUsd: undefined,
        transactions24h: 11,
      })
    );

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = fetchCall[1];
    expect(JSON.parse(options.body)).toEqual({
      transactions_24h: 11,
    });
  });
});

describe("capturePoolSnapshot — stable upstream failures", () => {
  test("maps unauthorized response to stable UpstreamError server_error from rails", async () => {
    mockFetchJson({ error: "unauthorized" }, 401);

    try {
      await capturePoolSnapshot(buildInput());
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      const upstream = err as UpstreamError;
      expect(upstream.category).toBe("server_error");
      expect(upstream.statusCode).toBe(401);
      expect(upstream.source).toBe("rails");
    }
  });

  test("maps malformed JSON to UpstreamError malformed", async () => {
    mockFetchJsonError(201);

    try {
      await capturePoolSnapshot(buildInput());
      expect.unreachable("Should have thrown");
    } catch (err) {
      expect(isUpstreamError(err)).toBe(true);
      const upstream = err as UpstreamError;
      expect(upstream.category).toBe("malformed");
      expect(upstream.statusCode).toBe(502);
      expect(upstream.source).toBe("rails");
    }
  });

  test("rejects created responses missing a valid captured_at string", async () => {
    mockFetchJson({ status: "created" }, 201);

    await expect(capturePoolSnapshot(buildInput())).rejects.toMatchObject({
      category: "malformed",
      statusCode: 502,
      source: "rails",
    });
  });

  test("rejects skipped responses with unexpected reason", async () => {
    mockFetchJson({ status: "skipped", reason: "later" }, 200);

    await expect(capturePoolSnapshot(buildInput())).rejects.toMatchObject({
      category: "malformed",
      statusCode: 502,
      source: "rails",
    });
  });

  test("maps transport timeout to UpstreamError timeout", async () => {
    mockFetchNetworkError(new DOMException("The operation was aborted", "TimeoutError"));

    await expect(capturePoolSnapshot(buildInput())).rejects.toMatchObject({
      category: "timeout",
      statusCode: 504,
      source: "rails",
    });
  });

  test("maps transport failure to UpstreamError timeout", async () => {
    mockFetchNetworkError(new TypeError("fetch failed"));

    await expect(capturePoolSnapshot(buildInput())).rejects.toMatchObject({
      category: "timeout",
      statusCode: 502,
      source: "rails",
    });
  });

  test("fails fast with stable upstream error when the internal capture secret is absent", async () => {
    vi.stubGlobal("fetch", vi.fn());
    delete process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET;

    await expect(capturePoolSnapshot(buildInput())).rejects.toMatchObject({
      category: "server_error",
      statusCode: 503,
      source: "rails",
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("normalizes production missing-secret config failure to stable upstream error before fetch", async () => {
    vi.stubGlobal("fetch", vi.fn());
    setNodeEnv("production");
    process.env.RAILS_BASE_URL = "https://rails.example.com";
    delete process.env.INTERNAL_SNAPSHOT_CAPTURE_SECRET;

    await expect(capturePoolSnapshot(buildInput())).rejects.toMatchObject({
      category: "server_error",
      statusCode: 503,
      source: "rails",
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
