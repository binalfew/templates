import { useLoaderData, useRouteLoaderData } from "react-router";
import { prisma } from "~/utils/db/db.server";
import { requireAuth } from "~/utils/auth/require-auth.server";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { getUnreadCount } from "~/services/notifications.server";
import {
  Users,
  Shield,
  KeyRound,
  Bell,
  ClipboardList,
} from "lucide-react";
import type { Route } from "./+types/index";

export const handle = { breadcrumb: "Dashboard" };

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAuth(request);
  const tenantId = user.tenantId;
  const tenantFilter = tenantId ? { tenantId } : {};

  const notificationsEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.NOTIFICATIONS, {
    tenantId: tenantId ?? undefined,
  });

  const [
    userCount,
    roleCount,
    permissionCount,
    recentAuditCount,
    unreadNotifications,
  ] = await Promise.all([
    prisma.user.count({ where: { ...tenantFilter, deletedAt: null } }),
    prisma.role.count({ where: tenantFilter }),
    prisma.permission.count(),
    prisma.auditLog.count({
      where: {
        ...(tenantId ? { tenantId } : {}),
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    notificationsEnabled ? getUnreadCount(user.id) : Promise.resolve(0),
  ]);

  return {
    userCount,
    roleCount,
    permissionCount,
    recentAuditCount,
    unreadNotifications,
    notificationsEnabled,
  };
}

export default function DashboardIndex() {
  const data = useLoaderData<typeof loader>();
  const layoutData = useRouteLoaderData("routes/$tenant/_layout") as
    | { user: { id: string; name: string | null; email: string }; roles: string[] }
    | undefined;

  const user = layoutData?.user;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Welcome{user?.name ? `, ${user.name}` : ""}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's an overview of your dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Users" value={data.userCount} icon={Users} />
        <StatCard title="Roles" value={data.roleCount} icon={Shield} />
        <StatCard title="Permissions" value={data.permissionCount} icon={KeyRound} />
        <StatCard title="Audit Events (24h)" value={data.recentAuditCount} icon={ClipboardList} />
      </div>

      {data.notificationsEnabled && data.unreadNotifications > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <Bell className="size-5 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              You have {data.unreadNotifications} unread notification
              {data.unreadNotifications > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Check your notifications to stay up to date.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg bg-card p-6 shadow">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
