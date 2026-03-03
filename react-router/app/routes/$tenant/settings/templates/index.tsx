import { Link, useLoaderData } from "react-router";
import { Mail, Plus, Pencil, Trash2 } from "lucide-react";

export const handle = { breadcrumb: "Templates" };

import { requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { listTemplatesPaginated } from "~/services/message-templates.server";
import { resolveViewContext } from "~/services/view-filters.server";
import { Badge } from "~/components/ui/badge";
import { DataTable } from "~/components/data-table/data-table";
import type { ColumnDef, PaginationMeta, ViewConfig } from "~/components/data-table/data-table-types";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { ViewSwitcher } from "~/components/views/view-switcher";
import { CHANNEL_COLORS } from "~/lib/email/messaging-constants";
import type { Route } from "./+types/index";

const TEMPLATE_FIELD_MAP: Record<string, string> = {
  name: "name",
  channel: "channel",
  subject: "subject",
  isSystem: "isSystem",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user, tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.BROADCASTS);

  const { savedViewsEnabled, activeViewId, activeViewType, availableViews, viewWhere, viewOrderBy } =
    await resolveViewContext(request, tenantId, user.id, "MessageTemplate", TEMPLATE_FIELD_MAP);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize")) || 10);
  const q = url.searchParams.get("q")?.trim() || "";

  const searchWhere = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { subject: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const andClauses = [viewWhere, searchWhere].filter((w) => Object.keys(w).length > 0);
  const combinedWhere = andClauses.length > 0 ? { AND: andClauses } : {};

  const { items: templates, totalCount } = await listTemplatesPaginated(tenantId, {
    where: combinedWhere,
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

export default function TemplatesListPage() {
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
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground shrink-0" />
          <Link to={`${base}/settings/templates/${row.id}`} className="hover:underline">
            {row.name}
          </Link>
        </div>
      ),
      sortable: true,
      cellClassName: "font-medium text-foreground",
    },
    {
      id: "channel",
      header: "Channel",
      cell: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CHANNEL_COLORS[row.channel] ?? "bg-gray-100 text-gray-800"}`}
        >
          {row.channel.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      id: "subject",
      header: "Subject",
      cell: (row) => row.subject || "\u2014",
      cellClassName: "text-muted-foreground max-w-xs truncate",
      hideOnMobile: true,
    },
    {
      id: "system",
      header: "System",
      align: "center",
      cell: (row) =>
        row.isSystem ? (
          <Badge variant="secondary" className="text-xs">
            System
          </Badge>
        ) : (
          <span className="text-muted-foreground">\u2014</span>
        ),
    },
    {
      id: "updatedAt",
      header: "Updated",
      sortable: true,
      cell: (row) => new Date(row.updatedAt).toLocaleDateString(),
      cellClassName: "text-muted-foreground",
      hideOnMobile: true,
    },
  ];

  const toolbarExtraNode = savedViewsEnabled && availableViews.length > 0 ? (
    <ViewSwitcher availableViews={availableViews} activeViewId={activeViewId} />
  ) : undefined;

  const viewConfig: ViewConfig<TemplateRow> = {
    kanban: {
      groupBy: "channel",
      getGroupValue: (t) => t.channel.replace(/_/g, " "),
      renderCard: (t) => (
        <div>
          <p className="font-semibold text-sm">{t.name}</p>
          {t.subject && (
            <p className="mt-1 text-sm text-muted-foreground">{t.subject}</p>
          )}
        </div>
      ),
      columnOrder: ["EMAIL", "SMS", "PUSH", "IN APP"],
    },
    gallery: {
      renderCard: (t) => (
        <div>
          <p className="font-semibold text-sm">{t.name}</p>
          <span
            className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CHANNEL_COLORS[t.channel] ?? "bg-gray-100 text-gray-800"}`}
          >
            {t.channel.replace(/_/g, " ")}
          </span>
          {t.subject && (
            <p className="mt-2 text-sm text-muted-foreground">{t.subject}</p>
          )}
        </div>
      ),
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Templates</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage message templates for notifications and broadcasts.
        </p>
      </div>

      <DataTable
        data={templates}
        columns={columns}
        searchConfig={{ placeholder: "Search templates..." }}
        toolbarExtra={toolbarExtraNode}
        toolbarActions={[
          { label: "New Template", icon: Plus, href: `${base}/settings/templates/new` },
        ]}
        rowActions={[
          {
            label: "Edit",
            icon: Pencil,
            href: (row) => `${base}/settings/templates/${row.id}/edit`,
            visible: (row) => !row.isSystem,
          },
          {
            label: "Delete",
            icon: Trash2,
            href: (row) => `${base}/settings/templates/${row.id}/delete`,
            variant: "destructive",
            visible: (row) => !row.isSystem,
          },
        ]}
        pagination={pagination}
        emptyState={{
          icon: Mail,
          title: "No templates",
          description: "Create a message template to get started.",
        }}
        viewType={activeViewType}
        viewConfig={viewConfig}
      />
    </div>
  );
}
