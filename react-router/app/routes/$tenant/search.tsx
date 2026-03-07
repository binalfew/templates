import { requireAuth } from "~/utils/auth/require-auth.server";
import { globalSearch } from "~/services/search.server";
import type { SearchResults } from "~/services/search.server";
import type { Route } from "./+types/search";

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const tenantId = user.tenantId!;

  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";

  if (!query || query.length < 2) {
    return { query, results: null as SearchResults | null };
  }

  const results = await globalSearch(query, tenantId);
  return { query, results };
}
