import { registerRailsUser } from "@/lib/api/rails-account";
import { registerRequestSchema } from "@/lib/validation/auth";
import {
  apiFailure,
  parseJsonBody,
  privateJson,
  setSessionCookie,
  validationError,
} from "@/app/api/auth/_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = registerRequestSchema.safeParse(await parseJsonBody(request));

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    const result = await registerRailsUser(parsed.data);
    const response = privateJson(result.session, 201);
    setSessionCookie(response, result.sessionToken);
    return response;
  } catch (error) {
    return apiFailure(error);
  }
}
