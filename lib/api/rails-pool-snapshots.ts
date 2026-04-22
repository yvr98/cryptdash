import {
  getRailsBaseUrl,
  getRailsInternalSnapshotCaptureSecret,
  getRailsPoolSnapshotHistoryPath,
  RAILS_INTERNAL_SNAPSHOT_CAPTURE_SECRET_HEADER,
  RAILS_INTERNAL_WRITE_REQUEST_TIMEOUT_MS,
  RAILS_POOL_SNAPSHOT_CAPTURE_PATH_TEMPLATE,
  RAILS_REQUEST_TIMEOUT_MS,
} from "@/lib/api/rails-config";
import { UpstreamError, classifyHttpStatus } from "@/lib/api/upstream-error";
import type { PoolSnapshotHistory, PoolSnapshotRow } from "@/lib/types";

const RAILS_SOURCE = "rails" as const;

export interface CapturePoolSnapshotInput {
  networkId: string;
  poolAddress: string;
  liquidityUsd?: number | null;
  volume24hUsd?: number | null;
  transactions24h?: number | null;
}

export type CapturePoolSnapshotResult =
  | {
      status: "created";
      capturedAt: string;
    }
  | {
      status: "skipped";
      reason: "throttled" | "no_metrics";
    };

export interface FetchPoolSnapshotHistoryInput {
  networkId: string;
  poolAddress: string;
  hours?: number;
}

function encodePathSegment(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`capturePoolSnapshot requires a non-empty ${field}`);
  }

  return encodeURIComponent(value.trim());
}

function buildCapturePath(networkId: string, poolAddress: string): string {
  return RAILS_POOL_SNAPSHOT_CAPTURE_PATH_TEMPLATE.replace(
    ":network_id",
    encodePathSegment(networkId, "networkId")
  ).replace(":pool_address", encodePathSegment(poolAddress, "poolAddress"));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value);
}

function buildCaptureBody(input: CapturePoolSnapshotInput): string {
  const body: Record<string, number> = {};

  if (input.liquidityUsd !== undefined && input.liquidityUsd !== null) {
    if (!isFiniteNumber(input.liquidityUsd)) {
      throw new Error("capturePoolSnapshot requires liquidityUsd to be a finite number when provided");
    }
    body.liquidity_usd = input.liquidityUsd;
  }

  if (input.volume24hUsd !== undefined && input.volume24hUsd !== null) {
    if (!isFiniteNumber(input.volume24hUsd)) {
      throw new Error("capturePoolSnapshot requires volume24hUsd to be a finite number when provided");
    }
    body.volume_24h_usd = input.volume24hUsd;
  }

  if (input.transactions24h !== undefined && input.transactions24h !== null) {
    if (!isFiniteInteger(input.transactions24h)) {
      throw new Error("capturePoolSnapshot requires transactions24h to be a finite integer when provided");
    }
    body.transactions_24h = input.transactions24h;
  }

  return JSON.stringify(body);
}

function isValidIsoDateString(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return false;
  }
  const iso = new Date(parsed).toISOString();
  // toISOString() always includes millis; Rails omits trailing .000
  return iso === value || iso.replace(".000Z", "Z") === value;
}

function hasExactKeys(obj: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(obj).sort();
  const sortedExpected = [...expectedKeys].sort();

  if (actualKeys.length !== sortedExpected.length) {
    return false;
  }

  return actualKeys.every((key, index) => key === sortedExpected[index]);
}

function parseDecimalString(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new UpstreamError("malformed", 502, RAILS_SOURCE);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new UpstreamError("malformed", 502, RAILS_SOURCE);
  }

  return parsed;
}

function parseNullableInteger(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value)) {
    throw new UpstreamError("malformed", 502, RAILS_SOURCE);
  }

  return value;
}

function validateSnapshotRow(raw: unknown): PoolSnapshotRow {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new UpstreamError("malformed", 502, RAILS_SOURCE);
  }

  const obj = raw as Record<string, unknown>;
  const expectedRowKeys = [
    "captured_at",
    "liquidity_usd",
    "volume_24h_usd",
    "transactions_24h",
  ] as const;

  if (!hasExactKeys(obj, expectedRowKeys)) {
    throw new UpstreamError("malformed", 502, RAILS_SOURCE);
  }

  if (!isValidIsoDateString(obj.captured_at)) {
    throw new UpstreamError("malformed", 502, RAILS_SOURCE);
  }

  return {
    capturedAt: obj.captured_at,
    liquidityUsd: parseDecimalString(obj.liquidity_usd),
    volume24hUsd: parseDecimalString(obj.volume_24h_usd),
    transactions24h: parseNullableInteger(obj.transactions_24h),
  };
}

function validateSnapshotHistoryPayload(raw: unknown): PoolSnapshotHistory {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new UpstreamError("malformed", 502, RAILS_SOURCE);
  }

  const obj = raw as Record<string, unknown>;
  const expectedEnvelopeKeys = ["window_hours", "row_count", "rows"] as const;

  if (!hasExactKeys(obj, expectedEnvelopeKeys)) {
    throw new UpstreamError("malformed", 502, RAILS_SOURCE);
  }

  if (obj.window_hours !== 24) {
    throw new UpstreamError("malformed", 502, RAILS_SOURCE);
  }

  if (
    typeof obj.row_count !== "number" ||
    !Number.isInteger(obj.row_count) ||
    obj.row_count < 0
  ) {
    throw new UpstreamError("malformed", 502, RAILS_SOURCE);
  }

  if (!Array.isArray(obj.rows)) {
    throw new UpstreamError("malformed", 502, RAILS_SOURCE);
  }

  const rows = obj.rows.map((row) => validateSnapshotRow(row));

  if (rows.length !== obj.row_count) {
    throw new UpstreamError("malformed", 502, RAILS_SOURCE);
  }

  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index - 1].capturedAt > rows[index].capturedAt) {
      throw new UpstreamError("malformed", 502, RAILS_SOURCE);
    }
  }

  return {
    windowHours: obj.window_hours,
    rowCount: obj.row_count,
    rows,
  };
}

function validateCaptureResponse(raw: unknown): CapturePoolSnapshotResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new UpstreamError("malformed", 502, RAILS_SOURCE);
  }

  const obj = raw as Record<string, unknown>;

  if (obj.status === "created") {
    if (!isValidIsoDateString(obj.captured_at)) {
      throw new UpstreamError("malformed", 502, RAILS_SOURCE);
    }

    return {
      status: "created",
      capturedAt: obj.captured_at,
    };
  }

  if (obj.status === "skipped") {
    if (obj.reason !== "throttled" && obj.reason !== "no_metrics") {
      throw new UpstreamError("malformed", 502, RAILS_SOURCE);
    }

    return {
      status: "skipped",
      reason: obj.reason,
    };
  }

  throw new UpstreamError("malformed", 502, RAILS_SOURCE);
}

export async function fetchPoolSnapshotHistory(
  input: FetchPoolSnapshotHistoryInput
): Promise<PoolSnapshotHistory> {
  const baseUrl = getRailsBaseUrl();
  const hours = input.hours ?? 24;
  const path = getRailsPoolSnapshotHistoryPath(input.networkId, input.poolAddress);
  const url = new URL(`${baseUrl}${path}`);
  url.searchParams.set("hours", String(hours));

  let res: Response;

  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(RAILS_REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new UpstreamError("timeout", 504, RAILS_SOURCE);
    }
    if (err instanceof TypeError) {
      throw new UpstreamError("timeout", 502, RAILS_SOURCE);
    }
    throw new UpstreamError("timeout", 502, RAILS_SOURCE);
  }

  if (!res.ok) {
    throw new UpstreamError(classifyHttpStatus(res.status), res.status, RAILS_SOURCE);
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new UpstreamError("malformed", 502, RAILS_SOURCE);
  }

  return validateSnapshotHistoryPayload(raw);
}

export function isPoolSnapshotCaptureConfigured(): boolean {
  try {
    return Boolean(getRailsInternalSnapshotCaptureSecret());
  } catch {
    return false;
  }
}

export async function capturePoolSnapshot(
  input: CapturePoolSnapshotInput
): Promise<CapturePoolSnapshotResult> {
  const baseUrl = getRailsBaseUrl();

  let secret: string | null;
  try {
    secret = getRailsInternalSnapshotCaptureSecret();
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("INTERNAL_SNAPSHOT_CAPTURE_SECRET is required in production")
    ) {
      throw new UpstreamError("server_error", 503, RAILS_SOURCE);
    }

    throw err;
  }

  if (!secret) {
    throw new UpstreamError("server_error", 503, RAILS_SOURCE);
  }

  const url = `${baseUrl}${buildCapturePath(input.networkId, input.poolAddress)}`;

  let res: Response;

  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        [RAILS_INTERNAL_SNAPSHOT_CAPTURE_SECRET_HEADER]: secret,
      },
      body: buildCaptureBody(input),
      signal: AbortSignal.timeout(RAILS_INTERNAL_WRITE_REQUEST_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new UpstreamError("timeout", 504, RAILS_SOURCE);
    }
    if (err instanceof TypeError) {
      throw new UpstreamError("timeout", 502, RAILS_SOURCE);
    }
    throw new UpstreamError("timeout", 502, RAILS_SOURCE);
  }

  if (!res.ok) {
    throw new UpstreamError(classifyHttpStatus(res.status), res.status, RAILS_SOURCE);
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new UpstreamError("malformed", 502, RAILS_SOURCE);
  }

  return validateCaptureResponse(raw);
}
