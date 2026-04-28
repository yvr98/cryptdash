import { deleteRailsWatchlistItem } from "@/lib/api/rails-account";
import { watchlistDeleteRequestSchema } from "@/lib/validation/watchlist";
import {
  apiFailure,
  getSessionToken,
  privateJson,
  validationError,
} from "@/app/api/auth/_shared";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ coinId: string }> }
) {
  const sessionToken = await getSessionToken();

  if (!sessionToken) {
    return privateJson({ error: "unauthenticated" }, 401);
  }

  const parsed = watchlistDeleteRequestSchema.safeParse(await params);

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    await deleteRailsWatchlistItem(sessionToken, parsed.data.coinId);
    return privateJson({ status: "ok" });
  } catch (error) {
    return apiFailure(error);
  }
}
