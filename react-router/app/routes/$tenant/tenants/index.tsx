import { Link, useLoaderData } from "react-router";
import { Building2, Plus, Pencil, Trash2, ExternalLink, Eye } from "lucide-react";

export const handle = { breadcrumb: "Tenants" };

import { requireAnyRole } from "~/lib/auth/require-auth.server";
import { listTenantsPaginated } from "~/services/tenants.server";
import { resolveViewContext } from "~/services/view-filters.server";
import { Badge } from "~/components/ui/badge";
import { DataTable } from "~/components/data-table/data-table";
import type { ColumnDef, PaginationMeta, ViewConfig } from "~/components/data-table/data-table-types";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { ViewSwitcher } from "~/components/views/view-switcher";
import type { Route } from "./+types/index";

const TENANT_FIELD_MAP: Record<string, string> = {
  name: "name",
  slug: "slug",
  email: "email",
  subscriptionPlan: "subscriptionPlan",
  createdAt: "createdAt",
};

const planVariant: Record<string, "default" | "secondary" | "outline"> = {
  free: "outline",
  starter: "secondary",
  professional: "default",
  enterprise: "default",
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAnyRole(request, ["ADMIN"]);
  const tenantId = user.tenantId;

  const viewCtx = tenantId
    ? await resolveViewContext(request, tenantId, user.id, "Tenant", TENANT_FIELD_MAP)
    : {
        savedViewsEnabled: false,
        activeViewId: null,
        activeViewType: null,
        availableViews: [],
        viewWhere: {},
        viewOrderBy: [],
      };
  const { savedViewsEnabled, activeViewId, activeViewType, availableViews, viewWhere, viewOrderBy } =
    viewCtx;

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize")) || 10);
  const q = url.searchParams.get("q")?.trim() || "";

  const searchWhere = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { slug: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const andClauses = [viewWhere, searchWhere].filter((w) => Object.keys(w).length > 0);
  const combinedWhere = andClauses.length > 0 ? { AND: andClauses } : {};

  const { items: tenants, totalCount } = await listTenantsPaginated({
    where: combinedWhere,
    orderBy: viewOrderBy,
    page,
    pageSize,
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    tenants,
    pagination: { page, pageSize, totalCount, totalPages } satisfies PaginationMeta,
    savedViewsEnabled,
    activeViewId,
    activeViewType,
    availableViews,
  };
}

type TenantRow = Awaited<ReturnType<typeof loader>>["tenants"][number];

export default function TenantsListPage() {
  const {
    tenants,
    pagination,
    savedViewsEnabled,
    activeViewId,
    activeViewType,
    availableViews,
  } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

  const columns: ColumnDef<TenantRow>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground shrink-0" />
          <Link to={`${base}/tenants/${row.id}`} className="hover:underline">
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
          /{row.slug}
        </Badge>
      ),
    },
    {
      id: "email",
      header: "Email",
      cell: "email",
      sortable: true,
      cellClassName: "text-muted-foreground",
      hideOnMobile: true,
    },
    {
      id: "plan",
      header: "Plan",
      cell: (row) => (
        <Badge variant={planVariant[row.subscriptionPlan] ?? "outline"} className="capitalize">
          {row.subscriptionPlan}
        </Badge>
      ),
    },
    {
      id: "users",
      header: "Users",
      align: "center",
      cell: (row) => (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
          {row._count.users}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      id: "roles",
      header: "Roles",
      align: "center",
      cell: (row) => (
        <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
          {row._count.roles}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      id: "created",
      header: "Created",
      cell: (row) => new Date(row.createdAt).toLocaleDateString(),
      hideOnMobile: true,
      cellClassName: "text-muted-foreground",
    },
  ];

  const toolbarExtraNode =
    savedViewsEnabled && availableViews.length > 0 ? (
      <ViewSwitcher availableViews={availableViews} activeViewId={activeViewId} />
    ) : undefined;

  const viewConfig: ViewConfig<TenantRow> = {
    gallery: {
      renderCard: (tenant) => (
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground shrink-0" />
            <p className="font-semibold text-sm">{tenant.name}</p>
          </div>
          <Badge variant="outline" className="mt-1 text-xs">
            /{tenant.slug}
          </Badge>
          <p className="mt-2 text-sm text-muted-foreground">{tenant.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={planVariant[tenant.subscriptionPlan] ?? "outline"} className="capitalize text-xs">
              {tenant.subscriptionPlan}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {tenant._count.users} user{tenant._count.users !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
      ),
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Tenants</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage organizations and their subscription plans.
        </p>
      </div>

      <DataTable
        data={tenants}
        columns={columns}
        searchConfig={{ placeholder: "Search tenants..." }}
        toolbarExtra={toolbarExtraNode}
        toolbarActions={[
          { label: "New Tenant", icon: Plus, href: `${base}/tenants/new` },
        ]}
        rowActions={[
          {
            label: "View",
            icon: Eye,
            href: (row) => `${base}/tenants/${row.id}`,
          },
          {
            label: "Edit",
            icon: Pencil,
            href: (row) => `${base}/tenants/${row.id}/edit`,
          },
          {
            label: "Delete",
            icon: Trash2,
            href: (row) => `${base}/tenants/${row.id}/delete`,
            variant: "destructive",
          },
        ]}
        pagination={pagination}
        emptyState={{
          icon: Building2,
          title: "No tenants found",
          description: "Tenants will appear here once they are created.",
        }}
        viewType={activeViewType}
        viewConfig={viewConfig}
      />
    </div>
  );
}
