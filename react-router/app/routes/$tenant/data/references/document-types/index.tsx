import { Link, useLoaderData } from "react-router";
import { FileText, Plus, Pencil, Trash2 } from "lucide-react";

export const handle = { breadcrumb: "Document Types" };

import { requireAnyRole } from "~/lib/auth/require-auth.server";
import { ADMIN_ONLY } from "~/lib/auth/roles";
import { listDocumentTypesPaginated } from "~/services/reference-data.server";
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
          { category: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const statusWhere =
    statusParam === "active"
      ? { isActive: true }
      : statusParam === "inactive"
        ? { isActive: false }
        : {};

  const { items: documentTypes, totalCount } = await listDocumentTypesPaginated({
    where: { ...searchWhere, ...statusWhere },
    page,
    pageSize,
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    documentTypes,
    pagination: { page, pageSize, totalCount, totalPages } satisfies PaginationMeta,
  };
}

type DocumentTypeRow = Awaited<ReturnType<typeof loader>>["documentTypes"][number];

export default function DocumentTypesListPage() {
  const { documentTypes, pagination } = useLoaderData<typeof loader>();
  const base = useBasePrefix();
  const basePath = `${base}/data/references/document-types`;

  const columns: ColumnDef<DocumentTypeRow>[] = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground shrink-0" />
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
      id: "category",
      header: "Category",
      cell: (row) => row.category || "\u2014",
      cellClassName: "text-muted-foreground",
      hideOnMobile: true,
    },
    {
      id: "description",
      header: "Description",
      cell: (row) => row.description || "\u2014",
      cellClassName: "text-muted-foreground max-w-xs truncate",
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
        <h2 className="text-2xl font-bold text-foreground">Document Types</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Identity, travel, and accreditation document categories.
        </p>
      </div>

      <DataTable
        data={documentTypes}
        columns={columns}
        searchConfig={{ placeholder: "Search document types..." }}
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
          { label: "New Document Type", icon: Plus, href: `${basePath}/new` },
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
          icon: FileText,
          title: "No document types found",
          description: "Document types will appear here once they are created.",
        }}
      />
    </div>
  );
}
