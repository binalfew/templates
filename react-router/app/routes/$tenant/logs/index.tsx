import { useLoaderData, useSearchParams, Link } from "react-router";
import { ClipboardList } from "lucide-react";
import { prisma } from "~/lib/db/db.server";
import { requireRole } from "~/lib/auth/require-auth.server";
import {
  isFeatureEnabled,
  FEATURE_FLAG_KEYS,
} from "~/lib/config/feature-flags.server";
import {
  resolveActiveView,
  buildPrismaWhere,
  buildPrismaOrderBy,
} from "~/services/view-filters.server";
import type { SavedViewFilter, SavedViewSort } from "~/services/saved-views.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { ViewSwitcher } from "~/components/views/view-switcher";
import { ViewRenderer } from "~/components/views/view-renderer";
import type { Route } from "./+types/index";

export const handle = { breadcrumb: "Logs" };

const PAGE_SIZE = 50;

const ACTION_TYPES = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
] as const;

const AUDIT_FIELD_MAP: Record<string, string> = {
  action: "action",
  entityType: "entityType",
  description: "description",
  ipAddress: "ipAddress",
  createdAt: "createdAt",
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireRole(request, "ADMIN");

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const actionFilter = url.searchParams.get("action") || "";

  const tenantId = user.tenantId;

  const savedViewsEnabled = tenantId
    ? await isFeatureEnabled(FEATURE_FLAG_KEYS.SAVED_VIEWS, {
        tenantId,
        userId: user.id,
      })
    : false;

  let activeView = null;
  let availableViews: Array<{
    id: string;
    name: string;
    viewType: string;
    isDefault: boolean;
    isShared: boolean;
  }> = [];

  if (savedViewsEnabled && tenantId) {
    const resolved = await resolveActiveView(request, tenantId, user.id, "AuditLog");
    activeView = resolved.activeView;
    availableViews = resolved.availableViews.map((v) => ({
      id: v.id,
      name: v.name,
      viewType: v.viewType,
      isDefault: v.isDefault,
      isShared: v.isShared,
    }));
  }

  const viewWhere = activeView
    ? buildPrismaWhere(activeView.filters as unknown as SavedViewFilter[], AUDIT_FIELD_MAP)
    : {};
  const viewOrderBy = activeView
    ? buildPrismaOrderBy(activeView.sorts as unknown as SavedViewSort[], AUDIT_FIELD_MAP)
    : [];

  const where = {
    ...(tenantId ? { tenantId } : {}),
    ...(actionFilter ? { action: actionFilter } : {}),
    ...viewWhere,
  };

  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: viewOrderBy.length ? (viewOrderBy as any) : { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      description: log.description,
      ipAddress: log.ipAddress,
      userName: log.user?.name ?? log.user?.email ?? "System",
      createdAt: log.createdAt.toISOString(),
    })),
    totalCount,
    page,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
    actionFilter,
    savedViewsEnabled,
    activeViewId: activeView?.id ?? null,
    activeViewType: activeView?.viewType ?? null,
    availableViews,
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionBadgeVariant(action: string) {
  switch (action) {
    case "CREATE":
      return "default" as const;
    case "UPDATE":
      return "secondary" as const;
    case "DELETE":
      return "destructive" as const;
    case "LOGIN":
      return "outline" as const;
    case "LOGOUT":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

export default function AuditLogsPage() {
  const {
    logs,
    totalCount,
    page,
    totalPages,
    actionFilter,
    savedViewsEnabled,
    activeViewId,
    activeViewType,
    availableViews,
  } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  function handleActionFilter(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set("action", value);
    } else {
      params.delete("action");
    }
    params.delete("page");
    setSearchParams(params);
  }

  const defaultRenderer = () => (
    <>
      {logs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No audit log entries found.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>User</TableHead>
              <TableHead>IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatDate(log.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge variant={actionBadgeVariant(log.action)}>{log.action}</Badge>
                </TableCell>
                <TableCell className="text-sm">{log.entityType}</TableCell>
                <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                  {log.description ?? "-"}
                </TableCell>
                <TableCell className="text-sm">{log.userName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.ipAddress ?? "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Logs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          View a record of all actions performed in the system.
        </p>
      </div>

      {savedViewsEnabled && (
        <ViewSwitcher
          availableViews={availableViews as any}
          activeViewId={activeViewId}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Activity Log
              </CardTitle>
              <CardDescription>
                {totalCount} {totalCount === 1 ? "entry" : "entries"} total
              </CardDescription>
            </div>
            <div className="w-40">
              <NativeSelect
                value={actionFilter}
                onChange={(e) => handleActionFilter(e.target.value)}
              >
                <NativeSelectOption value="">All Actions</NativeSelectOption>
                {ACTION_TYPES.map((action) => (
                  <NativeSelectOption key={action} value={action}>
                    {action}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ViewRenderer
            items={logs}
            viewType={activeViewType as any}
            entityConfig={{
              kanban: {
                groupBy: "action",
                getGroupValue: (log) => log.action,
                renderCard: (log) => (
                  <div>
                    <div className="flex items-center justify-between">
                      <Badge variant={actionBadgeVariant(log.action)} className="text-[10px]">
                        {log.action}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {log.entityType}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {log.description ?? "-"}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{log.userName}</span>
                      <span>{formatDate(log.createdAt)}</span>
                    </div>
                  </div>
                ),
                columnOrder: ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"],
              },
              calendar: {
                getDate: (log) => log.createdAt,
                renderItem: (log) => (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={actionBadgeVariant(log.action)} className="text-xs">
                        {log.action}
                      </Badge>
                      <span className="text-sm">{log.entityType}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{log.userName}</span>
                  </div>
                ),
              },
              gallery: {
                renderCard: (log) => (
                  <div>
                    <div className="flex items-center justify-between">
                      <Badge variant={actionBadgeVariant(log.action)}>{log.action}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium">{log.entityType}</p>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {log.description ?? "-"}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{log.userName}</span>
                      <span>{log.ipAddress ?? "-"}</span>
                    </div>
                  </div>
                ),
              },
            }}
            defaultRenderer={defaultRenderer}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to={`?${new URLSearchParams({ ...(actionFilter ? { action: actionFilter } : {}), page: String(page - 1) })}`}
                    >
                      Previous
                    </Link>
                  </Button>
                )}
                {page < totalPages && (
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      to={`?${new URLSearchParams({ ...(actionFilter ? { action: actionFilter } : {}), page: String(page + 1) })}`}
                    >
                      Next
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
