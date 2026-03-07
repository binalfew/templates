import { Link, useLoaderData } from "react-router";
import { ArrowLeft, Languages, Plus, Pencil, Trash2 } from "lucide-react";

export const handle = { breadcrumb: "Languages" };

import { requireAnyRole } from "~/utils/auth/require-auth.server";
import { ADMIN_ONLY } from "~/utils/auth/roles";
import { listLanguagesPaginated } from "~/services/reference-data.server";
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
          { nativeName: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const statusWhere =
    statusParam === "active"
      ? { isActive: true }
      : statusParam === "inactive"
        ? { isActive: false }
        : {};

  const { items: languages, totalCount } = await listLanguagesPaginated({
    where: { ...searchWhere, ...statusWhere },
    page,
    pageSize,
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    languages,
    pagination: { page, pageSize, totalCount, totalPages } satisfies PaginationMeta,
  };
}

type LanguageRow = Awaited<ReturnType<typeof loader>>["languages"][number];

export default function LanguagesListPage() {
  const { languages, pagination } = useLoaderData<typeof loader>();
  const base = useBasePrefix();
  const basePath = `${base}/data/references/languages`;

  const columns: ColumnDef<LanguageRow>[] = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Languages className="size-4 text-muted-foreground shrink-0" />
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
      id: "nativeName",
      header: "Native Name",
      cell: (row) => row.nativeName || "\u2014",
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
        <h2 className="text-2xl font-bold text-foreground">Languages</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ISO 639-1 language codes and native names.
        </p>
      </div>

      <DataTable
        data={languages}
        columns={columns}
        searchConfig={{ placeholder: "Search languages..." }}
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
          { label: "Back", icon: ArrowLeft, href: `${base}/data/references`, variant: "outline" },
          { label: "New Language", icon: Plus, href: `${basePath}/new` },
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
          icon: Languages,
          title: "No languages found",
          description: "Languages will appear here once they are created.",
        }}
      />
    </div>
  );
}
