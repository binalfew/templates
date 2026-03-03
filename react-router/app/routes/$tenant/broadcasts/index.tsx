import { data, Link, useLoaderData, useFetcher } from "react-router";
import { Send, XCircle, Plus, Pencil, Trash2 } from "lucide-react";
import { requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { listBroadcastsPaginated, sendBroadcast, cancelBroadcast } from "~/services/broadcasts.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { resolveViewContext } from "~/services/view-filters.server";
import { buildServiceContext } from "~/lib/request-context.server";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { BROADCAST_STATUS_COLORS, CHANNEL_COLORS } from "~/lib/email/messaging-constants";
import { Badge } from "~/components/ui/badge";
import { DataTable } from "~/components/data-table/data-table";
import type { ColumnDef, PaginationMeta, ViewConfig } from "~/components/data-table/data-table-types";
import { ViewSwitcher } from "~/components/views/view-switcher";
import type { Route } from "./+types/index";

export const handle = { breadcrumb: "Broadcasts" };

const BROADCAST_FIELD_MAP: Record<string, string> = {
  subject: "subject",
  channel: "channel",
  status: "status",
  createdAt: "createdAt",
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user, tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.BROADCASTS);

  const { savedViewsEnabled, activeViewId, activeViewType, availableViews, viewWhere, viewOrderBy } =
    await resolveViewContext(request, tenantId, user.id, "Broadcast", BROADCAST_FIELD_MAP);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize")) || 10);
  const q = url.searchParams.get("q")?.trim() || "";

  const searchWhere = q
    ? {
        OR: [{ subject: { contains: q, mode: "insensitive" as const } }],
      }
    : {};

  const { items: broadcasts, totalCount } = await listBroadcastsPaginated(tenantId, {
    where: { ...viewWhere, ...searchWhere },
    orderBy: viewOrderBy,
    page,
    pageSize,
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    broadcasts,
    pagination: { page, pageSize, totalCount, totalPages } satisfies PaginationMeta,
    savedViewsEnabled,
    activeViewId,
    activeViewType,
    availableViews,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user, tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.BROADCASTS);

  const formData = await request.formData();
  const _action = formData.get("_action") as string;

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    switch (_action) {
      case "send": {
        const broadcastId = formData.get("broadcastId") as string;
        await sendBroadcast(broadcastId, ctx);
        break;
      }
      case "cancel": {
        const broadcastId = formData.get("broadcastId") as string;
        await cancelBroadcast(broadcastId, undefined, ctx);
        break;
      }
      default:
        return data({ error: "Unknown action" }, { status: 400 });
    }
    return { ok: true };
  } catch (error) {
    return handleServiceError(error);
  }
}

type BroadcastRow = Awaited<ReturnType<typeof loader>>["broadcasts"][number];

export default function BroadcastsPage() {
  const {
    broadcasts,
    pagination,
    savedViewsEnabled,
    activeViewId,
    activeViewType,
    availableViews,
  } = useLoaderData<typeof loader>();
  const base = useBasePrefix();
  const fetcher = useFetcher();

  const columns: ColumnDef<BroadcastRow>[] = [
    {
      id: "subject",
      header: "Subject",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Send className="size-4 text-muted-foreground shrink-0" />
          <Link to={`${base}/broadcasts/${row.id}`} className="hover:underline">
            {row.subject || "(no subject)"}
          </Link>
        </div>
      ),
      sortable: true,
      cellClassName: "font-medium",
    },
    {
      id: "channel",
      header: "Channel",
      cell: (row) => (
        <Badge variant="secondary" className={CHANNEL_COLORS[row.channel]}>
          {row.channel}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <Badge variant={BROADCAST_STATUS_COLORS[row.status] ?? "secondary"}>
          {row.status}
        </Badge>
      ),
    },
    {
      id: "recipients",
      header: "Recipients",
      align: "center",
      cell: (row) => row.recipientCount ?? 0,
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

  const toolbarExtraNode = savedViewsEnabled && availableViews.length > 0 ? (
    <ViewSwitcher availableViews={availableViews as any} activeViewId={activeViewId} />
  ) : undefined;

  const viewConfig: ViewConfig<BroadcastRow> = {
    kanban: {
      groupBy: "status",
      getGroupValue: (row) => row.status,
      renderCard: (row) => (
        <div>
          <h3 className="font-semibold text-foreground">{row.subject || "(no subject)"}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary" className={CHANNEL_COLORS[row.channel]}>
              {row.channel}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(row.createdAt).toLocaleDateString()}
          </p>
        </div>
      ),
      columnOrder: ["DRAFT", "SCHEDULED", "SENDING", "SENT", "CANCELLED", "FAILED"],
    },
    gallery: {
      renderCard: (row) => (
        <div>
          <h3 className="font-semibold text-foreground">{row.subject || "(no subject)"}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary" className={CHANNEL_COLORS[row.channel]}>
              {row.channel}
            </Badge>
            <Badge variant={BROADCAST_STATUS_COLORS[row.status] ?? "secondary"}>
              {row.status}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(row.createdAt).toLocaleDateString()}
          </p>
        </div>
      ),
    },
    calendar: {
      getDate: (row) => row.createdAt,
      renderItem: (row) => (
        <span className="text-xs font-medium">{row.subject || "(no subject)"}</span>
      ),
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Broadcasts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send messages to your audience across channels.
        </p>
      </div>

      <DataTable
        data={broadcasts}
        columns={columns}
        searchConfig={{ placeholder: "Search broadcasts..." }}
        toolbarExtra={toolbarExtraNode}
        toolbarActions={[{ label: "New Broadcast", icon: Plus, href: `${base}/broadcasts/new` }]}
        rowActions={[
          {
            label: "Edit",
            icon: Pencil,
            href: (row) => `${base}/broadcasts/${row.id}/edit`,
            visible: (row) => row.status === "DRAFT",
          },
          {
            label: "Send",
            icon: Send,
            visible: (row) => row.status === "DRAFT",
            onClick: (row) => {
              const formData = new FormData();
              formData.set("_action", "send");
              formData.set("broadcastId", row.id);
              fetcher.submit(formData, { method: "post" });
            },
          },
          {
            label: "Cancel",
            icon: XCircle,
            variant: "destructive",
            visible: (row) => row.status === "SENDING" || row.status === "SCHEDULED",
            onClick: (row) => {
              const formData = new FormData();
              formData.set("_action", "cancel");
              formData.set("broadcastId", row.id);
              fetcher.submit(formData, { method: "post" });
            },
          },
          {
            label: "Delete",
            icon: Trash2,
            href: (row) => `${base}/broadcasts/${row.id}/delete`,
            variant: "destructive",
            visible: (row) => row.status !== "SENDING",
          },
        ]}
        pagination={pagination}
        emptyState={{
          icon: Send,
          title: "No broadcasts",
          description: "Create a broadcast to send messages.",
        }}
        viewType={activeViewType}
        viewConfig={viewConfig}
      />
    </div>
  );
}
