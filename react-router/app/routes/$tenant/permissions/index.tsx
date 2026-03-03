import { useLoaderData } from "react-router";
import { KeyRound, Plus, Pencil, Trash2 } from "lucide-react";

export const handle = { breadcrumb: "Permissions" };

import { requirePermission } from "~/lib/require-auth.server";
import { listPermissionsPaginated } from "~/services/permissions.server";
import { resolveViewContext } from "~/services/view-filters.server";
import { Badge } from "~/components/ui/badge";
import { DataTable } from "~/components/data-table/data-table";
import type { ColumnDef, PaginationMeta, ViewConfig } from "~/components/data-table/data-table-types";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { ViewSwitcher } from "~/components/views/view-switcher";
import type { Route } from "./+types/index";

const PERMISSION_FIELD_MAP: Record<string, string> = {
  resource: "resource",
  action: "action",
  description: "description",
  createdAt: "createdAt",
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;

  const viewCtx = tenantId
    ? await resolveViewContext(request, tenantId, user.id, "Permission", PERMISSION_FIELD_MAP)
    : { savedViewsEnabled: false, activeViewId: null, activeViewType: null, availableViews: [], viewWhere: {}, viewOrderBy: [] };
  const { savedViewsEnabled, activeViewId, activeViewType, availableViews, viewWhere, viewOrderBy } = viewCtx;

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize")) || 10);
  const q = url.searchParams.get("q")?.trim() || "";

  const searchWhere = q
    ? {
        OR: [
          { resource: { contains: q, mode: "insensitive" as const } },
          { action: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const andClauses = [viewWhere, searchWhere].filter((w) => Object.keys(w).length > 0);
  const combinedWhere = andClauses.length > 0 ? { AND: andClauses } : {};

  const { items: permissions, totalCount } = await listPermissionsPaginated({
    where: combinedWhere,
    orderBy: viewOrderBy,
    page,
    pageSize,
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    permissions,
    pagination: { page, pageSize, totalCount, totalPages } satisfies PaginationMeta,
    savedViewsEnabled,
    activeViewId,
    activeViewType,
    availableViews,
  };
}

type PermissionRow = Awaited<ReturnType<typeof loader>>["permissions"][number];

export default function PermissionsListPage() {
  const {
    permissions,
    pagination,
    savedViewsEnabled,
    activeViewId,
    activeViewType,
    availableViews,
  } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

  const columns: ColumnDef<PermissionRow>[] = [
    {
      id: "resource",
      header: "Resource",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground shrink-0" />
          <span>{row.resource}</span>
        </div>
      ),
      cellClassName: "font-medium text-foreground",
    },
    {
      id: "action",
      header: "Action",
      cell: (row) => (
        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {row.action}
        </span>
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
      id: "roles",
      header: "Roles",
      align: "center",
      cell: (row) => (
        <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
          {row._count.rolePermissions}
        </span>
      ),
    },
  ];

  const toolbarExtraNode = savedViewsEnabled ? (
    <ViewSwitcher availableViews={availableViews} activeViewId={activeViewId} />
  ) : undefined;

  const permissionCard = (p: PermissionRow) => (
    <div>
      <p className="font-semibold text-sm">{p.resource}</p>
      <Badge variant="default" className="mt-1 text-xs">
        {p.action}
      </Badge>
      <p className="mt-2 text-sm text-muted-foreground">
        {p.description || "No description"}
      </p>
      <Badge variant="outline" className="mt-2 text-xs">
        {p._count.rolePermissions} role{p._count.rolePermissions !== 1 ? "s" : ""}
      </Badge>
    </div>
  );

  const viewConfig: ViewConfig<PermissionRow> = {
    kanban: {
      groupBy: "resource",
      getGroupValue: (p) => p.resource,
      renderCard: (p) => (
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-[10px]">
              {p.action}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {p.description || "No description"}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {p._count.rolePermissions} role{p._count.rolePermissions !== 1 ? "s" : ""}
          </p>
        </div>
      ),
    },
    gallery: {
      renderCard: permissionCard,
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Permissions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage permissions and their role assignments.
        </p>
      </div>

      <DataTable
        data={permissions}
        columns={columns}
        searchConfig={{ placeholder: "Search permissions..." }}
        toolbarExtra={toolbarExtraNode}
        toolbarActions={[
          { label: "New Permission", icon: Plus, href: `${base}/permissions/new` },
        ]}
        rowActions={[
          { label: "Edit", icon: Pencil, href: (row) => `${base}/permissions/${row.id}/edit` },
          {
            label: "Delete",
            icon: Trash2,
            href: (row) => `${base}/permissions/${row.id}/delete`,
            variant: "destructive",
          },
        ]}
        pagination={pagination}
        emptyState={{
          icon: KeyRound,
          title: "No permissions found",
          description: "Permissions will appear here once they are created.",
        }}
        viewType={activeViewType}
        viewConfig={viewConfig}
      />
    </div>
  );
}
