import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ZodError } from "zod";

import { isRailsApiError } from "@/lib/api/rails-account";
import { RAILS_SESSION_COOKIE_NAME } from "@/lib/api/rails-config";
import { isUpstreamError } from "@/lib/api/upstream-error";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
};

const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function privateJson<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, {
    status,
    headers: PRIVATE_HEADERS,
  });
}

export function validationError(error: ZodError): NextResponse {
  return privateJson(
    {
      error: "invalid_request",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
    400
  );
}

export function apiFailure(error: unknown): NextResponse {
  if (isRailsApiError(error)) {
    return privateJson(error.payload ?? { error: "rails_request_failed" }, error.status);
  }

  if (isUpstreamError(error)) {
    return privateJson({ error: error.message }, error.statusCode);
  }

  return privateJson({ error: "request_failed" }, 502);
}

export function setSessionCookie(response: NextResponse, sessionToken: string): void {
  response.cookies.set({
    name: RAILS_SESSION_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: RAILS_SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(RAILS_SESSION_COOKIE_NAME)?.value ?? null;
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
