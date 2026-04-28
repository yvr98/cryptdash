import { destroyRailsSession } from "@/lib/api/rails-account";
import {
  apiFailure,
  clearSessionCookie,
  getSessionToken,
  privateJson,
} from "@/app/api/auth/_shared";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await destroyRailsSession(await getSessionToken());
    const response = privateJson({ status: "ok" });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    const response = apiFailure(error);
    clearSessionCookie(response);
    return response;
  }
}
