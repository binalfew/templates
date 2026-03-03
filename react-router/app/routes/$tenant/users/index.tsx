import { useLoaderData } from "react-router";
import { invariantResponse } from "@epic-web/invariant";
import { useTranslation } from "react-i18next";
import { Users, User, Plus, Mail, Pencil, Shield, Trash2 } from "lucide-react";
import { RouteErrorBoundary } from "~/components/route-error-boundary";

export const handle = { breadcrumb: "Users" };

export function ErrorBoundary() {
  return <RouteErrorBoundary context="users list" />;
}

import { requirePermission } from "~/lib/require-auth.server";
import { listUsersPaginated } from "~/services/users.server";
import { resolveViewContext } from "~/services/view-filters.server";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Badge } from "~/components/ui/badge";
import { DataTable } from "~/components/data-table/data-table";
import type { ColumnDef, PaginationMeta, ViewConfig } from "~/components/data-table/data-table-types";
import { ViewSwitcher } from "~/components/views/view-switcher";
import type { Route } from "./+types/index";

const USER_FIELD_MAP: Record<string, string> = {
  name: "name",
  email: "email",
  username: "username",
  status: "status",
  createdAt: "createdAt",
};

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  SUSPENDED: "bg-yellow-100 text-yellow-800",
  LOCKED: "bg-red-100 text-red-800",
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user, isSuperAdmin } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const { savedViewsEnabled, activeViewId, activeViewType, availableViews, viewWhere, viewOrderBy } =
    await resolveViewContext(request, tenantId, user.id, "User", USER_FIELD_MAP);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize")) || 10);
  const q = url.searchParams.get("q")?.trim() || "";

  const searchWhere = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { username: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const { items: users, totalCount } = await listUsersPaginated(
    isSuperAdmin ? undefined : tenantId,
    {
      where: { ...viewWhere, ...searchWhere },
      orderBy: viewOrderBy,
      page,
      pageSize,
    },
  );

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    users,
    isSuperAdmin,
    pagination: { page, pageSize, totalCount, totalPages } satisfies PaginationMeta,
    savedViewsEnabled,
    activeViewId,
    activeViewType,
    availableViews,
  };
}

type UserRow = Awaited<ReturnType<typeof loader>>["users"][number];

export default function UsersListPage() {
  const { t } = useTranslation("users");
  const {
    users,
    isSuperAdmin,
    pagination,
    savedViewsEnabled,
    activeViewId,
    activeViewType,
    availableViews,
  } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

  const columns: ColumnDef<UserRow>[] = [
    {
      id: "name",
      header: t("name"),
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <User className="size-4 text-muted-foreground shrink-0" />
          <span>{row.name || <span className="text-muted-foreground italic">No name</span>}</span>
        </div>
      ),
      cellClassName: "font-medium text-foreground",
    },
    {
      id: "email",
      header: t("email"),
      cell: "email",
      sortable: true,
      cellClassName: "text-muted-foreground",
    },
    {
      id: "username",
      header: t("username"),
      cell: "username",
      cellClassName: "text-muted-foreground",
      hideOnMobile: true,
    },
    ...(isSuperAdmin
      ? [
          {
            id: "tenant",
            header: "Tenant",
            cell: (row: UserRow) => row.tenant?.name ?? "\u2014",
            cellClassName: "text-muted-foreground",
            hideOnMobile: true,
          } satisfies ColumnDef<UserRow>,
        ]
      : []),
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[row.status] ?? "bg-gray-100 text-gray-800"}`}
        >
          {row.status}
        </span>
      ),
    },
    {
      id: "roles",
      header: t("roles"),
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.userRoles.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">None</span>
          ) : (
            row.userRoles.map((ur) => (
              <span
                key={ur.id}
                className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
              >
                {ur.role.name}
              </span>
            ))
          )}
        </div>
      ),
    },
  ];

  const toolbarExtraNode = savedViewsEnabled ? (
    <ViewSwitcher availableViews={availableViews as any} activeViewId={activeViewId} />
  ) : undefined;

  const viewConfig: ViewConfig<UserRow> = {
    kanban: {
      groupBy: "status",
      getGroupValue: (u) => u.status,
      renderCard: (u) => (
        <div>
          <p className="font-medium text-sm">{u.name || u.email}</p>
          <p className="text-xs text-muted-foreground">{u.email}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {u.userRoles.map((ur) => (
              <Badge key={ur.id} variant="secondary" className="text-[10px]">
                {ur.role.name}
              </Badge>
            ))}
          </div>
        </div>
      ),
      columnOrder: ["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"],
    },
    calendar: {
      getDate: (u) => u.createdAt,
      renderItem: (u) => (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{u.name || u.email}</p>
            <p className="text-xs text-muted-foreground">{u.email}</p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[u.status] ?? "bg-gray-100 text-gray-800"}`}
          >
            {u.status}
          </span>
        </div>
      ),
    },
    gallery: {
      renderCard: (u) => (
        <div>
          <p className="font-semibold">{u.name || u.email}</p>
          <p className="text-sm text-muted-foreground">{u.email}</p>
          <p className="text-xs text-muted-foreground">@{u.username}</p>
          <div className="mt-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[u.status] ?? "bg-gray-100 text-gray-800"}`}
            >
              {u.status}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {u.userRoles.map((ur) => (
              <Badge key={ur.id} variant="secondary" className="text-[10px]">
                {ur.role.name}
              </Badge>
            ))}
          </div>
        </div>
      ),
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <DataTable
        data={users}
        columns={columns}
        searchConfig={{ placeholder: "Search users..." }}
        toolbarExtra={toolbarExtraNode}
        toolbarActions={[
          { label: t("inviteUser"), icon: Mail, href: `${base}/users/invite`, variant: "outline" },
          { label: t("newUser"), icon: Plus, href: `${base}/users/new` },
        ]}
        rowActions={[
          { label: "Edit", icon: Pencil, href: (row) => `${base}/users/${row.id}/edit` },
          { label: "Roles", icon: Shield, href: (row) => `${base}/users/${row.id}/roles` },
          {
            label: "Delete",
            icon: Trash2,
            href: (row) => `${base}/users/${row.id}/delete`,
            variant: "destructive",
          },
        ]}
        pagination={pagination}
        emptyState={{
          icon: Users,
          title: t("noUsers"),
          description: t("noUsersDesc"),
        }}
        viewType={activeViewType}
        viewConfig={viewConfig}
      />
    </div>
  );
}
