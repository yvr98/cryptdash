import {
  getRailsBaseUrl,
  getRailsWatchlistItemPath,
  RAILS_REQUEST_TIMEOUT_MS,
  RAILS_SESSION_PATH,
  RAILS_USERS_PATH,
  RAILS_WATCHLIST_ITEMS_PATH,
} from "@/lib/api/rails-config";
import { UpstreamError } from "@/lib/api/upstream-error";
import type {
  AccountWatchlistItem,
  RailsAuthMutationPayload,
  RailsSessionPayload,
  RailsWatchlistItemEnvelope,
  RailsWatchlistItemsPayload,
  SessionResponse,
} from "@/lib/types";

type RailsRequestOptions = {
  method: "GET" | "POST" | "DELETE";
  body?: unknown;
  sessionToken?: string | null;
};

type AuthCredentials = {
  email: string;
  password: string;
};

type RegisterCredentials = AuthCredentials & {
  passwordConfirmation: string;
};

type WatchlistItemInput = {
  coinId: string;
  name: string;
  symbol: string;
  thumbUrl?: string;
};

export class RailsApiError extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown
  ) {
    super(`Rails API request failed with status ${status}`);
    this.name = "RailsApiError";
  }
}

export function isRailsApiError(error: unknown): error is RailsApiError {
  return error instanceof RailsApiError;
}

async function requestRailsJson<T>(
  path: string,
  options: RailsRequestOptions
): Promise<T> {
  const url = `${getRailsBaseUrl()}${path}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.sessionToken) {
    headers.Authorization = `Bearer ${options.sessionToken}`;
  }

  let response: Response;

  try {
    response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(RAILS_REQUEST_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new UpstreamError("timeout", 504, "rails");
    }
    throw new UpstreamError("timeout", 502, "rails");
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new RailsApiError(response.status, payload);
  }

  return payload as T;
}

function validateSessionPayload(raw: unknown): RailsSessionPayload {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new UpstreamError("malformed", 502, "rails");
  }

  const obj = raw as Record<string, unknown>;
  const capabilities = obj.capabilities;

  if (
    typeof obj.authenticated !== "boolean" ||
    typeof obj.status !== "string" ||
    (obj.user !== null && typeof obj.user !== "object") ||
    typeof capabilities !== "object" ||
    capabilities === null ||
    Array.isArray(capabilities)
  ) {
    throw new UpstreamError("malformed", 502, "rails");
  }

  const caps = capabilities as Record<string, unknown>;
  if (
    typeof caps.google_oauth !== "boolean" ||
    typeof caps.write_auth_enabled !== "boolean"
  ) {
    throw new UpstreamError("malformed", 502, "rails");
  }

  return raw as RailsSessionPayload;
}

function toSessionResponse(raw: unknown): SessionResponse {
  const session = validateSessionPayload(raw);

  return {
    authenticated: session.authenticated,
    status: session.status,
    user: session.user,
    capabilities: {
      google_oauth: session.capabilities.google_oauth,
      write_auth_enabled: session.capabilities.write_auth_enabled,
    },
  };
}

function toAuthResult(raw: RailsAuthMutationPayload): {
  sessionToken: string;
  session: SessionResponse;
} {
  if (typeof raw.session_token !== "string" || raw.session_token.length === 0) {
    throw new UpstreamError("malformed", 502, "rails");
  }

  return {
    sessionToken: raw.session_token,
    session: toSessionResponse(raw.session),
  };
}

function toAccountWatchlistItem(raw: unknown): AccountWatchlistItem {
  if (typeof raw !== "object" || raw === null) {
    throw new UpstreamError("malformed", 502, "rails");
  }

  const item = raw as Record<string, unknown>;

  if (
    typeof item.coin_id !== "string" ||
    typeof item.name !== "string" ||
    typeof item.symbol !== "string" ||
    (item.thumb_url !== null && typeof item.thumb_url !== "string") ||
    typeof item.added_at !== "string"
  ) {
    throw new UpstreamError("malformed", 502, "rails");
  }

  return {
    coinId: item.coin_id,
    name: item.name,
    symbol: item.symbol,
    thumbUrl: item.thumb_url,
    addedAt: item.added_at,
  };
}

export async function registerRailsUser(credentials: RegisterCredentials) {
  const payload = await requestRailsJson<RailsAuthMutationPayload>(RAILS_USERS_PATH, {
    method: "POST",
    body: {
      email: credentials.email,
      password: credentials.password,
      password_confirmation: credentials.passwordConfirmation,
    },
  });

  return toAuthResult(payload);
}

export async function createRailsSession(credentials: AuthCredentials) {
  const payload = await requestRailsJson<RailsAuthMutationPayload>(RAILS_SESSION_PATH, {
    method: "POST",
    body: credentials,
  });

  return toAuthResult(payload);
}

export async function destroyRailsSession(sessionToken: string | null | undefined) {
  if (!sessionToken) return;

  await requestRailsJson<{ status: string }>(RAILS_SESSION_PATH, {
    method: "DELETE",
    sessionToken,
  });
}

export async function fetchRailsWatchlist(sessionToken: string) {
  const payload = await requestRailsJson<RailsWatchlistItemsPayload>(
    RAILS_WATCHLIST_ITEMS_PATH,
    {
      method: "GET",
      sessionToken,
    }
  );

  if (!Array.isArray(payload.items)) {
    throw new UpstreamError("malformed", 502, "rails");
  }

  return payload.items.map(toAccountWatchlistItem);
}

export async function createRailsWatchlistItem(
  sessionToken: string,
  item: WatchlistItemInput
) {
  const payload = await requestRailsJson<RailsWatchlistItemEnvelope>(
    RAILS_WATCHLIST_ITEMS_PATH,
    {
      method: "POST",
      sessionToken,
      body: {
        coin_id: item.coinId,
        name: item.name,
        symbol: item.symbol,
        thumb_url: item.thumbUrl,
      },
    }
  );

  return toAccountWatchlistItem(payload.item);
}

export async function deleteRailsWatchlistItem(
  sessionToken: string,
  coinId: string
) {
  await requestRailsJson<{ status: string }>(getRailsWatchlistItemPath(coinId), {
    method: "DELETE",
    sessionToken,
  });
}
