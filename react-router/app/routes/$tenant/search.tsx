import { Form, Link, useLoaderData, useSearchParams } from "react-router";
import { Search as SearchIcon, Users, Shield, KeyRound, Box, ClipboardList } from "lucide-react";
import { requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { globalSearch } from "~/services/search.server";
import type { SearchResults, SearchResult } from "~/services/search.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { EmptyState } from "~/components/ui/empty-state";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/search";

export const handle = { breadcrumb: "Search" };

const ENTITY_TYPES = ["User", "Role", "Permission", "CustomObject", "AuditLog"] as const;

const ENTITY_CONFIG: Record<
  string,
  { icon: typeof Users; label: string; colorClass: string }
> = {
  User: { icon: Users, label: "Users", colorClass: "bg-blue-100 text-blue-800" },
  Role: { icon: Shield, label: "Roles", colorClass: "bg-purple-100 text-purple-800" },
  Permission: {
    icon: KeyRound,
    label: "Permissions",
    colorClass: "bg-amber-100 text-amber-800",
  },
  CustomObject: {
    icon: Box,
    label: "Custom Objects",
    colorClass: "bg-green-100 text-green-800",
  },
  AuditLog: {
    icon: ClipboardList,
    label: "Audit Logs",
    colorClass: "bg-slate-100 text-slate-800",
  },
};

function groupResults(results: SearchResult[]) {
  const groups: { type: string; items: SearchResult[] }[] = [];
  for (const type of ENTITY_TYPES) {
    const items = results.filter((r) => r.type === type);
    if (items.length > 0) {
      groups.push({ type, items });
    }
  }
  return groups;
}

function SearchResultCard({
  result,
  basePrefix,
}: {
  result: SearchResult;
  basePrefix: string;
}) {
  const config = ENTITY_CONFIG[result.type];
  const Icon = config?.icon ?? Users;
  const colorClass = config?.colorClass ?? "bg-muted text-muted-foreground";

  return (
    <Link
      key={result.id}
      to={`${basePrefix}/${result.url}`}
      className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50 transition-colors"
    >
      <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{result.title}</p>
        {result.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
        )}
      </div>
      <Badge className={colorClass}>{config?.label ?? result.type}</Badge>
    </Link>
  );
}

export async function loader({ request }: Route.LoaderArgs) {
  const { tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.GLOBAL_SEARCH);

  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const typeFilter = url.searchParams.get("type") || "";

  if (!query || query.length < 2) {
    return { query, results: null as SearchResults | null, typeFilter };
  }

  const results = await globalSearch(query, tenantId);

  if (typeFilter && ENTITY_TYPES.includes(typeFilter as (typeof ENTITY_TYPES)[number])) {
    const filtered = results.results.filter((r) => r.type === typeFilter);
    return {
      query,
      results: { ...results, results: filtered, total: filtered.length },
      typeFilter,
    };
  }

  return { query, results, typeFilter };
}

export default function SearchPage() {
  const { query, results, typeFilter } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const basePrefix = useBasePrefix();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Search</h2>
        <p className="text-sm text-muted-foreground">
          Search across users, roles, permissions, custom objects, and audit logs
        </p>
      </div>
      <Separator />

      <Form
        method="get"
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2"
      >
        <div className="w-full sm:w-auto">
          <NativeSelect
            name="type"
            defaultValue={searchParams.get("type") ?? ""}
            className="w-full sm:w-auto sm:min-w-[160px]"
          >
            <NativeSelectOption value="">All types</NativeSelectOption>
            {ENTITY_TYPES.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {ENTITY_CONFIG[type].label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="relative w-full sm:flex-1 sm:min-w-0">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={searchParams.get("q") ?? ""}
            placeholder="Search by name, email, or description..."
            className="pl-10"
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full sm:w-auto">
          Search
        </Button>
      </Form>

      {query && !results && (
        <p className="text-sm text-muted-foreground">Enter at least 2 characters to search.</p>
      )}

      {results && results.total === 0 && (
        <EmptyState
          icon={SearchIcon}
          title="No results"
          description={
            typeFilter
              ? `No ${ENTITY_CONFIG[typeFilter]?.label.toLowerCase() ?? typeFilter} found for "${query}". Try removing the type filter.`
              : `No results found for "${query}".`
          }
        />
      )}

      {results && results.total > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {results.total} result{results.total !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
            {typeFilter && ENTITY_CONFIG[typeFilter] && (
              <> in {ENTITY_CONFIG[typeFilter].label.toLowerCase()}</>
            )}
          </p>

          {typeFilter ? (
            <div className="space-y-1">
              {results.results.map((result) => (
                <SearchResultCard key={result.id} result={result} basePrefix={basePrefix} />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {groupResults(results.results).map(({ type, items }) => {
                const config = ENTITY_CONFIG[type];
                const Icon = config?.icon ?? Users;
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">{config?.label ?? type}</h3>
                      <Badge variant="outline">{items.length}</Badge>
                    </div>
                    <div className="space-y-2 pl-7">
                      {items.map((result) => (
                        <SearchResultCard
                          key={result.id}
                          result={result}
                          basePrefix={basePrefix}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
