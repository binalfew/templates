import { data, useFetcher, useLoaderData, useSearchParams } from "react-router";
import {
  Bell,
  CheckCheck,
  Info,
  AlertTriangle,
  FileText,
  Workflow,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { requireAuth } from "~/lib/require-auth.server";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/lib/feature-flags.server";
import { listNotifications, markAllAsRead } from "~/services/notifications.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { EmptyState } from "~/components/ui/empty-state";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/index";

export const handle = { breadcrumb: "Notifications" };

export async function loader({ request }: Route.LoaderArgs) {
  const { user, roles } = await requireAuth(request);

  const enabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.NOTIFICATIONS, {
    tenantId: user.tenantId ?? undefined,
    roles,
    userId: user.id,
  });

  if (!enabled) {
    throw data({ error: "Notifications are not enabled" }, { status: 404 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const type = url.searchParams.get("type") || undefined;
  const readParam = url.searchParams.get("read");
  const read = readParam === "true" ? true : readParam === "false" ? false : undefined;

  const result = await listNotifications(user.id, {
    page,
    perPage: 20,
    type,
    read,
  });

  return { ...result, currentType: type ?? "", currentRead: readParam ?? "" };
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "mark-all-read") {
    await markAllAsRead(user.id);
    return data({ ok: true });
  }

  return data({ error: "Unknown intent" }, { status: 400 });
}

// --- Helpers ---

const NOTIFICATION_TYPES = [
  { value: "", label: "All types" },
  { value: "approval_required", label: "Approval Required" },
  { value: "sla_warning", label: "SLA Warning" },
  { value: "form_published", label: "Form Published" },
  { value: "system", label: "System" },
];

const READ_FILTERS = [
  { value: "", label: "All" },
  { value: "false", label: "Unread" },
  { value: "true", label: "Read" },
];

function getTypeIcon(type: string) {
  switch (type) {
    case "approval_required":
      return Workflow;
    case "sla_warning":
      return AlertTriangle;
    case "form_published":
      return FileText;
    default:
      return Info;
  }
}

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

export default function NotificationsPage() {
  const { notifications, total, page, totalPages, currentType, currentRead } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page"); // Reset to page 1 on filter change
    setSearchParams(params);
  }

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams);
    if (p > 1) {
      params.set("page", String(p));
    } else {
      params.delete("page");
    }
    setSearchParams(params);
  }

  function handleMarkRead(notificationId: string) {
    fetcher.submit(
      { intent: "mark-read", notificationId },
      { method: "post", action: "/api/notifications" },
    );
  }

  function handleDelete(notificationId: string) {
    fetcher.submit(
      { intent: "delete", notificationId },
      { method: "post", action: "/api/notifications" },
    );
  }

  function handleMarkAllRead() {
    fetcher.submit({ intent: "mark-all-read" }, { method: "post" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {total} notification{total !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
          <CheckCheck className="mr-2 size-4" />
          Mark all as read
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Type filter */}
            <NativeSelect
              value={currentType}
              onChange={(e) => updateFilter("type", e.target.value)}
              className="w-auto min-w-[140px]"
            >
              {NOTIFICATION_TYPES.map((t) => (
                <NativeSelectOption key={t.value} value={t.value}>
                  {t.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>

            {/* Read/Unread filter */}
            <div className="flex gap-1">
              {READ_FILTERS.map((f) => (
                <Button
                  key={f.value}
                  variant={currentRead === f.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateFilter("read", f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Bell}
                title="No notifications"
                description="You're all caught up! Notifications will appear here when there's something new."
              />
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = getTypeIcon(notification.type);
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "group flex items-start gap-4 px-6 py-4",
                      !notification.read && "bg-muted/30",
                    )}
                  >
                    <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{notification.title}</p>
                        {!notification.read && <span className="size-2 rounded-full bg-primary" />}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{notification.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => handleMarkRead(notification.id)}
                          title="Mark as read"
                        >
                          <CheckCheck className="size-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(notification.id)}
                        title="Delete"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft className="mr-1 size-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Next
            <ChevronRight className="ml-1 size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
