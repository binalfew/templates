import { useLoaderData } from "react-router";
import { ClipboardList } from "lucide-react";
import { prisma } from "~/utils/db/db.server";
import { requireRole } from "~/utils/auth/require-auth.server";
import { Badge } from "~/components/ui/badge";
import { DataTable } from "~/components/data-table/data-table";
import type { ColumnDef, PaginationMeta, FilterDef } from "~/components/data-table/data-table-types";
import type { Route } from "./+types/index";

export const handle = { breadcrumb: "Logs" };

const ACTION_TYPES = ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"] as const;

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireRole(request, "ADMIN");
  const tenantId = user.tenantId;

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize")) || 50);
  const q = url.searchParams.get("q")?.trim() || "";
  const actionFilter = url.searchParams.get("action") || "";

  const searchWhere = q
    ? {
        OR: [
          { description: { contains: q, mode: "insensitive" as const } },
          { entityType: { contains: q, mode: "insensitive" as const } },
          { ipAddress: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const filterWhere = actionFilter ? { action: actionFilter } : {};

  const andClauses = [
    tenantId ? { tenantId } : {},
    filterWhere,
    searchWhere,
  ].filter((w) => Object.keys(w).length > 0);
  const where = andClauses.length > 0 ? { AND: andClauses } : {};

  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

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
    pagination: { page, pageSize, totalCount, totalPages } satisfies PaginationMeta,
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
    case "LOGOUT":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

type LogRow = Awaited<ReturnType<typeof loader>>["logs"][number];

export default function AuditLogsPage() {
  const { logs, pagination } = useLoaderData<typeof loader>();

  const columns: ColumnDef<LogRow>[] = [
    {
      id: "createdAt",
      header: "Date",
      cell: (row) => formatDate(row.createdAt),
      sortable: true,
      cellClassName: "whitespace-nowrap",
    },
    {
      id: "action",
      header: "Action",
      cell: (row) => <Badge variant={actionBadgeVariant(row.action)}>{row.action}</Badge>,
    },
    {
      id: "entityType",
      header: "Entity Type",
      cell: (row) => row.entityType,
    },
    {
      id: "description",
      header: "Description",
      cell: (row) => row.description ?? "\u2014",
      cellClassName: "text-muted-foreground max-w-xs truncate",
      hideOnMobile: true,
    },
    {
      id: "userName",
      header: "User",
      cell: (row) => row.userName,
      hideOnMobile: true,
    },
    {
      id: "ipAddress",
      header: "IP Address",
      cell: (row) => row.ipAddress ?? "\u2014",
      cellClassName: "text-muted-foreground",
      hideOnMobile: true,
    },
  ];

  const filters: FilterDef[] = [
    {
      paramKey: "action",
      label: "Action",
      placeholder: "All Actions",
      options: ACTION_TYPES.map((a) => ({ label: a, value: a })),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Logs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          View a record of all actions performed in the system.
        </p>
      </div>

      <DataTable
        data={logs}
        columns={columns}
        searchConfig={{ placeholder: "Search logs..." }}
        filters={filters}
        pagination={pagination}
        emptyState={{
          icon: ClipboardList,
          title: "No audit log entries",
          description: "Activity will appear here as actions are performed in the system.",
        }}
      />
    </div>
  );
}
