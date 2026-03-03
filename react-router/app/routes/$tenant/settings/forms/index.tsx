import { Link, useLoaderData } from "react-router";
import { FileText, Plus, Pencil, Trash2, PenTool } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { listSectionTemplatesPaginated } from "~/services/section-templates.server";
import { resolveViewContext } from "~/services/view-filters.server";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { DataTable } from "~/components/data-table/data-table";
import type { ColumnDef, PaginationMeta, ViewConfig } from "~/components/data-table/data-table-types";
import { ViewSwitcher } from "~/components/views/view-switcher";
import type { Route } from "./+types/index";

export const handle = { breadcrumb: "Forms" };

const FIELD_MAP: Record<string, string> = {
  name: "name",
  status: "status",
  entityType: "entityType",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user, tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.FORM_DESIGNER);

  const { savedViewsEnabled, activeViewId, activeViewType, availableViews, viewWhere, viewOrderBy } =
    await resolveViewContext(request, tenantId, user.id, "SectionTemplate", FIELD_MAP);

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

  const { items: templates, totalCount } = await listSectionTemplatesPaginated(tenantId, {
    where: { ...viewWhere, ...searchWhere },
    orderBy: viewOrderBy,
    page,
    pageSize,
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    templates,
    pagination: { page, pageSize, totalCount, totalPages } satisfies PaginationMeta,
    savedViewsEnabled,
    activeViewId,
    activeViewType,
    availableViews,
  };
}

type TemplateRow = Awaited<ReturnType<typeof loader>>["templates"][number];

export default function FormsPage() {
  const {
    templates,
    pagination,
    savedViewsEnabled,
    activeViewId,
    activeViewType,
    availableViews,
  } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

  const columns: ColumnDef<TemplateRow>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => (
        <Link
          to={`${base}/settings/forms/${row.id}`}
          className="flex items-center gap-2 hover:underline"
        >
          <FileText className="size-4 text-muted-foreground shrink-0" />
          <span>{row.name}</span>
        </Link>
      ),
      sortable: true,
      cellClassName: "font-medium",
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => {
        const variant =
          row.status === "PUBLISHED"
            ? "outline"
            : "secondary";
        const className =
          row.status === "PUBLISHED"
            ? "border-green-500 text-green-700 dark:text-green-400"
            : row.status === "ARCHIVED"
              ? "text-muted-foreground"
              : undefined;
        return (
          <Badge variant={variant} className={className}>
            {row.status}
          </Badge>
        );
      },
      sortable: true,
    },
    {
      id: "entityType",
      header: "Entity Type",
      cell: (row) => (
        <Badge variant="secondary">{row.entityType}</Badge>
      ),
      sortable: true,
      hideOnMobile: true,
    },
    {
      id: "description",
      header: "Description",
      cell: (row) => (
        <span className="text-muted-foreground">{row.description || "\u2014"}</span>
      ),
      hideOnMobile: true,
    },
    {
      id: "updated",
      header: "Updated",
      cell: (row) => new Date(row.updatedAt).toLocaleDateString(),
      sortable: true,
      hideOnMobile: true,
      cellClassName: "text-muted-foreground",
    },
  ];

  const toolbarExtraNode = savedViewsEnabled && availableViews.length > 0 ? (
    <ViewSwitcher availableViews={availableViews as any} activeViewId={activeViewId} />
  ) : undefined;

  const viewConfig: ViewConfig<TemplateRow> = {
    gallery: {
      renderCard: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{row.name}</h3>
            <Badge
              variant={row.status === "PUBLISHED" ? "outline" : "secondary"}
              className={
                row.status === "PUBLISHED"
                  ? "border-green-500 text-green-700 dark:text-green-400"
                  : row.status === "ARCHIVED"
                    ? "text-muted-foreground"
                    : undefined
              }
            >
              {row.status}
            </Badge>
            <Badge variant="secondary">{row.entityType}</Badge>
          </div>
          {row.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{row.description}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(row.updatedAt).toLocaleDateString()}
          </p>
        </div>
      ),
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Forms</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage form templates and design forms with drag-and-drop.
        </p>
      </div>

      <DataTable
        data={templates}
        columns={columns}
        searchConfig={{ placeholder: "Search forms..." }}
        toolbarExtra={toolbarExtraNode}
        toolbarActions={[{ label: "New Form", icon: Plus, href: `${base}/settings/forms/new` }]}
        rowActions={[
          {
            label: "Designer",
            icon: PenTool,
            href: (row) => `${base}/settings/forms/${row.id}/designer`,
          },
          {
            label: "Edit",
            icon: Pencil,
            href: (row) => `${base}/settings/forms/${row.id}/edit`,
          },
          {
            label: "Delete",
            icon: Trash2,
            href: (row) => `${base}/settings/forms/${row.id}/delete`,
            variant: "destructive",
          },
        ]}
        pagination={pagination}
        emptyState={{
          icon: FileText,
          title: "No form templates",
          description: "Create a form template to start designing forms.",
        }}
        viewType={activeViewType}
        viewConfig={viewConfig}
      />
    </div>
  );
}
