import { Link, useLoaderData } from "react-router";
import { invariantResponse } from "@epic-web/invariant";
import { Shield, Plus, Pencil, Trash2, KeyRound } from "lucide-react";

export const handle = { breadcrumb: "Roles" };

import { requirePermission } from "~/lib/auth/require-auth.server";
import { listRolesPaginated } from "~/services/roles.server";
import { resolveViewContext } from "~/services/view-filters.server";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { DataTable } from "~/components/data-table/data-table";
import type { ColumnDef, PaginationMeta, ViewConfig } from "~/components/data-table/data-table-types";
import { ViewSwitcher } from "~/components/views/view-switcher";
import type { Route } from "./+types/index";

const ROLE_FIELD_MAP: Record<string, string> = {
  name: "name",
  description: "description",
  createdAt: "createdAt",
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const { savedViewsEnabled, activeViewId, activeViewType, availableViews, viewWhere, viewOrderBy } =
    await resolveViewContext(request, tenantId, user.id, "Role", ROLE_FIELD_MAP);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize")) || 10);
  const q = url.searchParams.get("q")?.trim() || "";

  const searchWhere = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { description: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const { items: roles, totalCount } = await listRolesPaginated(tenantId, {
    where: { ...viewWhere, ...searchWhere },
    orderBy: viewOrderBy,
    page,
    pageSize,
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    roles,
    pagination: { page, pageSize, totalCount, totalPages } satisfies PaginationMeta,
    savedViewsEnabled,
    activeViewId,
    activeViewType,
    availableViews,
  };
}

type RoleRow = Awaited<ReturnType<typeof loader>>["roles"][number];

export default function RolesListPage() {
  const { roles, pagination, savedViewsEnabled, activeViewId, activeViewType, availableViews } =
    useLoaderData<typeof loader>();
  const base = useBasePrefix();

  const columns: ColumnDef<RoleRow>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-muted-foreground shrink-0" />
          <Link to={`${base}/security/roles/${row.id}`} className="hover:underline">
            {row.name}
          </Link>
        </div>
      ),
      sortable: true,
      cellClassName: "font-semibold text-foreground",
    },
    {
      id: "description",
      header: "Description",
      cell: (row) => row.description || "\u2014",
      cellClassName: "text-muted-foreground max-w-xs truncate",
      hideOnMobile: true,
    },
    {
      id: "users",
      header: "Users",
      align: "center",
      cell: (row) => (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
          {row._count.userRoles}
        </span>
      ),
    },
    {
      id: "permissions",
      header: "Permissions",
      align: "center",
      cell: (row) => (
        <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
          {row._count.rolePermissions}
        </span>
      ),
    },
  ];

  const toolbarExtraNode = savedViewsEnabled && availableViews.length > 0 ? (
    <ViewSwitcher availableViews={availableViews as any} activeViewId={activeViewId} />
  ) : undefined;

  const viewConfig: ViewConfig<RoleRow> = {
    kanban: {
      groupBy: "scope",
      getGroupValue: (role) => role.scope,
      renderCard: (role) => (
        <div>
          <h3 className="font-semibold text-foreground">{role.name}</h3>
          {role.description && (
            <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
          )}
        </div>
      ),
      columnOrder: ["GLOBAL", "TENANT", "EVENT"],
    },
    gallery: {
      renderCard: (role) => (
        <div>
          <h3 className="font-semibold text-foreground">{role.name}</h3>
          {role.description && (
            <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
          )}
        </div>
      ),
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Roles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage roles and their permission assignments.
        </p>
      </div>

      <DataTable
        data={roles}
        columns={columns}
        searchConfig={{ placeholder: "Search roles..." }}
        toolbarExtra={toolbarExtraNode}
        toolbarActions={[{ label: "New Role", icon: Plus, href: `${base}/security/roles/new` }]}
        rowActions={[
          { label: "Edit", icon: Pencil, href: (row) => `${base}/security/roles/${row.id}/edit` },
          {
            label: "Permissions",
            icon: KeyRound,
            href: (row) => `${base}/security/roles/${row.id}/permissions`,
          },
          {
            label: "Delete",
            icon: Trash2,
            href: (row) => `${base}/security/roles/${row.id}/delete`,
            variant: "destructive",
          },
        ]}
        pagination={pagination}
        emptyState={{
          icon: Shield,
          title: "No roles found",
          description: "Roles will appear here once they are created.",
        }}
        viewType={activeViewType}
        viewConfig={viewConfig}
      />
    </div>
  );
}
