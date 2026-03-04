import { Link, useLoaderData } from "react-router";
import { Globe, Plus, Pencil, Trash2 } from "lucide-react";

export const handle = { breadcrumb: "Countries" };

import { requireAnyRole } from "~/lib/auth/require-auth.server";
import { ADMIN_ONLY } from "~/lib/auth/roles";
import { listCountriesPaginated } from "~/services/reference-data.server";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { DataTable } from "~/components/data-table/data-table";
import { Badge } from "~/components/ui/badge";
import type { ColumnDef, PaginationMeta } from "~/components/data-table/data-table-types";
import type { Route } from "./+types/index";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnyRole(request, [...ADMIN_ONLY]);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize")) || 10);
  const q = url.searchParams.get("q")?.trim() || "";
  const statusParam = url.searchParams.get("status");

  const searchWhere = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { code: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const statusWhere =
    statusParam === "active"
      ? { isActive: true }
      : statusParam === "inactive"
        ? { isActive: false }
        : {};

  const { items: countries, totalCount } = await listCountriesPaginated({
    where: { ...searchWhere, ...statusWhere },
    page,
    pageSize,
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    countries,
    pagination: { page, pageSize, totalCount, totalPages } satisfies PaginationMeta,
  };
}

type CountryRow = Awaited<ReturnType<typeof loader>>["countries"][number];

export default function CountriesListPage() {
  const { countries, pagination } = useLoaderData<typeof loader>();
  const base = useBasePrefix();
  const basePath = `${base}/data/references/countries`;

  const columns: ColumnDef<CountryRow>[] = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-muted-foreground shrink-0" />
          <Link to={`${basePath}/${row.id}`} className="hover:underline">
            {row.name}
          </Link>
        </div>
      ),
      cellClassName: "font-medium text-foreground",
    },
    {
      id: "code",
      header: "Code",
      sortable: true,
      cell: (row) => (
        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {row.code}
        </span>
      ),
    },
    {
      id: "alpha3",
      header: "Alpha-3",
      cell: "alpha3",
      hideOnMobile: true,
    },
    {
      id: "phoneCode",
      header: "Phone Code",
      cell: "phoneCode",
      hideOnMobile: true,
    },
    {
      id: "status",
      header: "Status",
      align: "center",
      cell: (row) => (
        <Badge variant={row.isActive ? "default" : "secondary"}>
          {row.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Countries</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ISO 3166-1 country codes, names, phone codes, and flags.
        </p>
      </div>

      <DataTable
        data={countries}
        columns={columns}
        searchConfig={{ placeholder: "Search countries..." }}
        filters={[
          {
            paramKey: "status",
            label: "Status",
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ],
            placeholder: "All statuses",
          },
        ]}
        toolbarActions={[
          { label: "New Country", icon: Plus, href: `${basePath}/new` },
        ]}
        rowActions={[
          { label: "Edit", icon: Pencil, href: (row) => `${basePath}/${row.id}/edit` },
          {
            label: "Delete",
            icon: Trash2,
            href: (row) => `${basePath}/${row.id}/delete`,
            variant: "destructive",
          },
        ]}
        pagination={pagination}
        emptyState={{
          icon: Globe,
          title: "No countries found",
          description: "Countries will appear here once they are created.",
        }}
      />
    </div>
  );
}
