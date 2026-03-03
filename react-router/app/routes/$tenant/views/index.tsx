import { useLoaderData } from "react-router";
import {
  Plus,
  Trash2,
  Pencil,
  Copy,
  Table2,
  LayoutGrid,
  Calendar,
  Image,
  Eye,
} from "lucide-react";
import { requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { listViews } from "~/services/saved-views.server";
import { Badge } from "~/components/ui/badge";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { DataTable } from "~/components/data-table/data-table";
import type { ColumnDef } from "~/components/data-table/data-table-types";
import type { Route } from "./+types/index";

export const handle = { breadcrumb: "Views" };

const VIEW_TYPE_ICONS: Record<string, typeof Table2> = {
  TABLE: Table2,
  KANBAN: LayoutGrid,
  CALENDAR: Calendar,
  GALLERY: Image,
};

const VIEW_TYPE_LABELS: Record<string, string> = {
  TABLE: "Table",
  KANBAN: "Kanban",
  CALENDAR: "Calendar",
  GALLERY: "Gallery",
};

const ENTITY_TYPES = ["User", "Role", "Permission", "AuditLog"];

export async function loader({ request }: Route.LoaderArgs) {
  const { user, tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.SAVED_VIEWS);

  const allViews: Array<
    Awaited<ReturnType<typeof listViews>>[number] & { entityType: string }
  > = [];

  for (const entityType of ENTITY_TYPES) {
    const views = await listViews(tenantId, user.id, entityType);
    for (const view of views) {
      allViews.push({ ...view, entityType });
    }
  }

  return { views: allViews, userId: user.id };
}

type ViewRow = Awaited<ReturnType<typeof loader>>["views"][number];

export default function SavedViewsListPage() {
  const { views, userId } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

  const columns: ColumnDef<ViewRow>[] = [
    {
      id: "name",
      header: "Name",
      cell: (row) => {
        const Icon = VIEW_TYPE_ICONS[row.viewType] ?? Table2;
        return (
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground shrink-0" />
            <span>{row.name}</span>
          </div>
        );
      },
      cellClassName: "font-medium text-foreground",
    },
    {
      id: "entityType",
      header: "Entity",
      cell: "entityType",
      cellClassName: "text-muted-foreground",
    },
    {
      id: "viewType",
      header: "Type",
      cell: (row) => VIEW_TYPE_LABELS[row.viewType] ?? row.viewType,
      cellClassName: "text-muted-foreground",
      hideOnMobile: true,
    },
    {
      id: "owner",
      header: "Owner",
      cell: (row) => (row.userId === userId ? "You" : row.owner?.name ?? "\u2014"),
      cellClassName: "text-muted-foreground",
      hideOnMobile: true,
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.isDefault && (
            <Badge variant="secondary" className="text-xs">
              Default
            </Badge>
          )}
          {row.isShared && (
            <Badge variant="outline" className="text-xs">
              Shared
            </Badge>
          )}
          {!row.isDefault && !row.isShared && (
            <span className="text-xs text-muted-foreground">{"\u2014"}</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Views</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and manage custom views for your data.
        </p>
      </div>

      <DataTable
        data={views}
        columns={columns}
        searchConfig={{ placeholder: "Search views..." }}
        toolbarActions={[
          { label: "New View", icon: Plus, href: `${base}/views/new` },
        ]}
        rowActions={[
          {
            label: "Edit",
            icon: Pencil,
            href: (row) => `${base}/views/${row.id}/edit`,
            visible: (row) => row.userId === userId,
          },
          {
            label: "Duplicate",
            icon: Copy,
            href: (row) => `${base}/views/${row.id}/duplicate`,
            visible: (row) => row.userId === userId,
          },
          {
            label: "Delete",
            icon: Trash2,
            href: (row) => `${base}/views/${row.id}/delete`,
            variant: "destructive",
            visible: (row) => row.userId === userId,
          },
        ]}
        emptyState={{
          icon: Eye,
          title: "No saved views",
          description:
            "Create a view to save your custom filters, sorts, and column configurations.",
        }}
      />
    </div>
  );
}
