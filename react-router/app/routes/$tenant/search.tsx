import { requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { globalSearch } from "~/services/search.server";
import type { SearchResults } from "~/services/search.server";
import type { Route } from "./+types/search";

export async function loader({ request }: Route.LoaderArgs) {
  const { tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.GLOBAL_SEARCH);

  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";

  if (!query || query.length < 2) {
    return { query, results: null as SearchResults | null };
  }

  const results = await globalSearch(query, tenantId);
  return { query, results };
}
