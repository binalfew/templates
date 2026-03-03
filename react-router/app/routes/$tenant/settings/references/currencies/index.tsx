import { Link, useLoaderData, useSearchParams } from "react-router";
import { Banknote, Plus } from "lucide-react";

export const handle = { breadcrumb: "Currencies" };

import { requireUser } from "~/lib/session.server";
import { listCurrencies } from "~/services/reference-data.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { EmptyState } from "~/components/ui/empty-state";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { ReferenceDataTable } from "~/components/reference-data/reference-data-table";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/index";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || undefined;
  const isActive =
    url.searchParams.get("status") === "active"
      ? true
      : url.searchParams.get("status") === "inactive"
        ? false
        : undefined;
  const currencies = await listCurrencies({ search, isActive });
  return { currencies };
}

export default function CurrenciesListPage() {
  const { currencies } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const basePrefix = useBasePrefix();
  const basePath = `${basePrefix}/settings/references/currencies`;

  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setSearchParams(params);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Currencies</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {currencies.length} currenc{currencies.length !== 1 ? "ies" : "y"}
          </p>
        </div>
        <Button asChild>
          <Link to={`${basePath}/new`}>
            <Plus className="mr-2 h-4 w-4" />
            New Currency
          </Link>
        </Button>
      </div>

      {currencies.length === 0 && !search && !status ? (
        <EmptyState
          icon={Banknote}
          title="No currencies found"
          description="Currencies will appear here once they are created."
        />
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Input
              type="search"
              placeholder="Search currencies..."
              value={search}
              onChange={(e) => updateParams("search", e.target.value)}
              className="max-w-xs"
            />
            <NativeSelect value={status} onChange={(e) => updateParams("status", e.target.value)}>
              <NativeSelectOption value="">All statuses</NativeSelectOption>
              <NativeSelectOption value="active">Active</NativeSelectOption>
              <NativeSelectOption value="inactive">Inactive</NativeSelectOption>
            </NativeSelect>
            <span className="ml-auto text-sm text-muted-foreground">
              Showing {currencies.length}
            </span>
          </div>
          <ReferenceDataTable
            items={currencies}
            columns={[
              { key: "code", label: "Code" },
              { key: "name", label: "Name" },
              { key: "symbol", label: "Symbol" },
              { key: "decimalDigits", label: "Decimals" },
            ]}
            baseUrl={basePath}
          />
        </>
      )}
    </div>
  );
}
