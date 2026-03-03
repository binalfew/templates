import { Link, useLoaderData } from "react-router";
import { Box, Plus, Pencil, Trash2, Database } from "lucide-react";

export const handle = { breadcrumb: "Objects" };

import { requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { listDefinitionsPaginated } from "~/services/custom-objects.server";
import type { CustomFieldDefinition } from "~/services/custom-objects.server";
import { resolveViewContext } from "~/services/view-filters.server";
import { Badge } from "~/components/ui/badge";
import { DataTable } from "~/components/data-table/data-table";
import type { ColumnDef, PaginationMeta, ViewConfig } from "~/components/data-table/data-table-types";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { ViewSwitcher } from "~/components/views/view-switcher";
import type { Route } from "./+types/index";

const OBJECT_FIELD_MAP: Record<string, string> = {
  name: "name",
  slug: "slug",
  description: "description",
  isActive: "isActive",
  createdAt: "createdAt",
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user, tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.CUSTOM_OBJECTS);

  const { savedViewsEnabled, activeViewId, activeViewType, availableViews, viewWhere, viewOrderBy } =
    await resolveViewContext(request, tenantId, user.id, "CustomObject", OBJECT_FIELD_MAP);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize")) || 10);
  const q = url.searchParams.get("q")?.trim() || "";

  const searchWhere = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { slug: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const andClauses = [viewWhere, searchWhere].filter((w) => Object.keys(w).length > 0);
  const combinedWhere = andClauses.length > 0 ? { AND: andClauses } : {};

  const { items: definitions, totalCount } = await listDefinitionsPaginated(tenantId, {
    where: combinedWhere,
    orderBy: viewOrderBy,
    page,
    pageSize,
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    definitions,
    pagination: { page, pageSize, totalCount, totalPages } satisfies PaginationMeta,
    savedViewsEnabled,
    activeViewId,
    activeViewType,
    availableViews,
  };
}

type DefinitionRow = Awaited<ReturnType<typeof loader>>["definitions"][number];

export default function CustomObjectsPage() {
  const {
    definitions,
    pagination,
    savedViewsEnabled,
    activeViewId,
    activeViewType,
    availableViews,
  } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

  const columns: ColumnDef<DefinitionRow>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Box className="size-4 text-muted-foreground shrink-0" />
          <Link to={`${base}/settings/objects/${row.slug}`} className="hover:underline">
            {row.name}
          </Link>
        </div>
      ),
      sortable: true,
      cellClassName: "font-medium text-foreground",
    },
    {
      id: "slug",
      header: "Slug",
      cell: (row) => (
        <Badge variant="outline" className="text-xs">
          {row.slug}
        </Badge>
      ),
    },
    {
      id: "description",
      header: "Description",
      cell: (row) => row.description || "\u2014",
      cellClassName: "text-muted-foreground max-w-xs truncate",
      hideOnMobile: true,
    },
    {
      id: "fields",
      header: "Fields",
      align: "center",
      cell: (row) => {
        const fields = (row.fields as unknown as CustomFieldDefinition[]) ?? [];
        return (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
            {fields.length}
          </span>
        );
      },
    },
    {
      id: "records",
      header: "Records",
      align: "center",
      cell: (row) => (
        <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
          {row._count.records}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            row.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
          }`}
        >
          {row.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  const toolbarExtraNode = savedViewsEnabled && availableViews.length > 0 ? (
    <ViewSwitcher availableViews={availableViews} activeViewId={activeViewId} />
  ) : undefined;

  const viewConfig: ViewConfig<DefinitionRow> = {
    kanban: {
      groupBy: "status",
      getGroupValue: (def) => (def.isActive ? "Active" : "Inactive"),
      renderCard: (def) => {
        const fields = (def.fields as unknown as CustomFieldDefinition[]) ?? [];
        return (
          <div>
            <p className="font-semibold text-sm">{def.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {def.description || "No description"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">
                {fields.length} field{fields.length !== 1 ? "s" : ""}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {def._count.records} record{def._count.records !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
        );
      },
      columnOrder: ["Active", "Inactive"],
    },
    gallery: {
      renderCard: (def) => {
        const fields = (def.fields as unknown as CustomFieldDefinition[]) ?? [];
        return (
          <div>
            <p className="font-semibold text-sm">{def.name}</p>
            <Badge variant="outline" className="mt-1 text-xs">
              {def.slug}
            </Badge>
            <p className="mt-2 text-sm text-muted-foreground">
              {def.description || "No description"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">
                {fields.length} field{fields.length !== 1 ? "s" : ""}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {def._count.records} record{def._count.records !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
        );
      },
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Objects</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Define custom entity types with dynamic fields.
        </p>
      </div>

      <DataTable
        data={definitions}
        columns={columns}
        searchConfig={{ placeholder: "Search objects..." }}
        toolbarExtra={toolbarExtraNode}
        toolbarActions={[
          { label: "New Object", icon: Plus, href: `${base}/settings/objects/new` },
        ]}
        rowActions={[
          {
            label: "View Records",
            icon: Database,
            href: (row) => `${base}/settings/objects/${row.slug}`,
          },
          {
            label: "Edit",
            icon: Pencil,
            href: (row) => `${base}/settings/objects/${row.id}/edit`,
          },
          {
            label: "Delete",
            icon: Trash2,
            href: (row) => `${base}/settings/objects/${row.id}/delete`,
            variant: "destructive",
          },
        ]}
        pagination={pagination}
        emptyState={{
          icon: Database,
          title: "No custom objects",
          description: "Create an object type to define custom entities with dynamic fields.",
        }}
        viewType={activeViewType}
        viewConfig={viewConfig}
      />
    </div>
  );
}
