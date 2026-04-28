import { createRailsSession } from "@/lib/api/rails-account";
import { loginRequestSchema } from "@/lib/validation/auth";
import {
  apiFailure,
  parseJsonBody,
  privateJson,
  setSessionCookie,
  validationError,
} from "@/app/api/auth/_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = loginRequestSchema.safeParse(await parseJsonBody(request));

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    const result = await createRailsSession(parsed.data);
    const response = privateJson(result.session, 200);
    setSessionCookie(response, result.sessionToken);
    return response;
  } catch (error) {
    return apiFailure(error);
  }
}
