import {
  createRailsWatchlistItem,
  fetchRailsWatchlist,
} from "@/lib/api/rails-account";
import { watchlistItemRequestSchema } from "@/lib/validation/watchlist";
import {
  apiFailure,
  getSessionToken,
  parseJsonBody,
  privateJson,
  validationError,
} from "@/app/api/auth/_shared";

export const dynamic = "force-dynamic";

function unauthenticated() {
  return privateJson({ error: "unauthenticated" }, 401);
}

export async function GET() {
  const sessionToken = await getSessionToken();

  if (!sessionToken) {
    return unauthenticated();
  }

  try {
    const items = await fetchRailsWatchlist(sessionToken);
    return privateJson({ items });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function POST(request: Request) {
  const sessionToken = await getSessionToken();

  if (!sessionToken) {
    return unauthenticated();
  }

  const parsed = watchlistItemRequestSchema.safeParse(await parseJsonBody(request));

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  try {
    const item = await createRailsWatchlistItem(sessionToken, parsed.data);
    return privateJson({ item }, 201);
  } catch (error) {
    return apiFailure(error);
  }
}
