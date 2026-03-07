import { data, useFetcher, useLoaderData } from "react-router";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { requireAuth } from "~/utils/auth/require-auth.server";
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "~/services/notifications.server";
import { DataTable } from "~/components/data-table/data-table";
import type { ColumnDef, PaginationMeta } from "~/components/data-table/data-table-types";
import { Badge } from "~/components/ui/badge";
import type { Route } from "./+types/index";

export const handle = { breadcrumb: "Notifications" };

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize")) || 20);
  const q = url.searchParams.get("q")?.trim() || undefined;
  const type = url.searchParams.get("type") || undefined;
  const readParam = url.searchParams.get("read");
  const read = readParam === "true" ? true : readParam === "false" ? false : undefined;

  const result = await listNotifications(user.id, {
    page,
    perPage: pageSize,
    type,
    read,
    search: q,
  });

  return {
    notifications: result.notifications,
    pagination: {
      page: result.page,
      pageSize: result.perPage,
      totalCount: result.total,
      totalPages: result.totalPages,
    } satisfies PaginationMeta,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "mark-all-read") {
    await markAllAsRead(user.id);
    return data({ ok: true });
  }

  const notificationId = formData.get("notificationId") as string;

  if (intent === "mark-read" && notificationId) {
    await markAsRead(notificationId, user.id);
    return data({ ok: true });
  }

  if (intent === "delete" && notificationId) {
    await deleteNotification(notificationId, user.id);
    return data({ ok: true });
  }

  return data({ error: "Unknown intent" }, { status: 400 });
}

// --- Helpers ---

function formatRelativeTime(dateStr: string | Date): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// --- Component ---

type NotificationRow = Awaited<ReturnType<typeof loader>>["notifications"][number];

export default function NotificationsPage() {
  const { notifications, pagination } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const columns: ColumnDef<NotificationRow>[] = [
    {
      id: "title",
      header: "Title",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span>{row.title}</span>
          {!row.read && <span className="size-2 shrink-0 rounded-full bg-primary" />}
        </div>
      ),
      sortable: true,
      cellClassName: "font-medium text-foreground",
    },
    {
      id: "message",
      header: "Message",
      cell: (row) => (
        <span className="line-clamp-1">{row.message}</span>
      ),
      cellClassName: "text-muted-foreground max-w-xs truncate",
      hideOnMobile: true,
    },
    {
      id: "type",
      header: "Type",
      cell: (row) => (
        <Badge variant="outline" className="text-xs capitalize">
          {row.type.replace(/_/g, " ")}
        </Badge>
      ),
      hideOnMobile: true,
    },
    {
      id: "read",
      header: "Status",
      cell: (row) => (
        <Badge variant={row.read ? "secondary" : "default"} className="text-xs">
          {row.read ? "Read" : "Unread"}
        </Badge>
      ),
    },
    {
      id: "createdAt",
      header: "Time",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(row.createdAt)}
        </span>
      ),
      sortable: true,
      hideOnMobile: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          View and manage your notifications.
        </p>
      </div>

      <DataTable
        data={notifications}
        columns={columns}
        searchConfig={{ paramKey: "q", placeholder: "Search notifications..." }}
        filters={[
          {
            paramKey: "type",
            label: "Type",
            options: [
              { label: "Role Assigned", value: "role_assigned" },
              { label: "Info", value: "INFO" },
              { label: "System", value: "system" },
            ],
            placeholder: "All types",
          },
          {
            paramKey: "read",
            label: "Status",
            options: [
              { label: "Unread", value: "false" },
              { label: "Read", value: "true" },
            ],
            placeholder: "All",
          },
        ]}
        toolbarActions={[
          {
            label: "Mark all read",
            icon: CheckCheck,
            variant: "outline",
            onClick: () => fetcher.submit({ intent: "mark-all-read" }, { method: "post" }),
          },
        ]}
        rowActions={[
          {
            label: "Mark as read",
            icon: CheckCheck,
            onClick: (row) =>
              fetcher.submit(
                { intent: "mark-read", notificationId: row.id },
                { method: "post" },
              ),
            visible: (row) => !row.read,
          },
          {
            label: "Delete",
            icon: Trash2,
            variant: "destructive",
            onClick: (row) =>
              fetcher.submit(
                { intent: "delete", notificationId: row.id },
                { method: "post" },
              ),
          },
        ]}
        pagination={pagination}
        emptyState={{
          icon: Bell,
          title: "No notifications",
          description: "You're all caught up! Notifications will appear here when there's something new.",
        }}
      />
    </div>
  );
}
