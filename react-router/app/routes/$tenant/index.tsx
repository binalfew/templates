import { Suspense } from "react";
import { useLoaderData, useRouteLoaderData, Await } from "react-router";
import { prisma } from "~/utils/db/db.server";
import { requireAuth } from "~/utils/auth/require-auth.server";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { getUnreadCount } from "~/services/notifications.server";
import {
  getUserGrowth,
  getLoginActivity,
  getRoleDistribution,
  getSessionActivity,
} from "~/services/analytics.server";
import { LineChartCard, BarChartCard, PieChartCard } from "~/components/analytics/charts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Users,
  Shield,
  KeyRound,
  Bell,
  ClipboardList,
  Activity,
  Clock,
  Loader2,
} from "lucide-react";
import type { Route } from "./+types/index";

export const handle = { breadcrumb: "Dashboard" };

export async function loader({ request }: Route.LoaderArgs) {
  const { user, roles } = await requireAuth(request);
  const tenantId = user.tenantId;
  const tenantFilter = tenantId ? { tenantId } : {};

  const notificationsEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.NOTIFICATIONS, {
    tenantId: tenantId ?? undefined,
  });

  const isAdmin = roles.includes("ADMIN") || roles.includes("TENANT_ADMIN");
  const analyticsEnabled =
    isAdmin &&
    (await isFeatureEnabled(FEATURE_FLAG_KEYS.ANALYTICS, {
      tenantId: tenantId ?? undefined,
    }));

  const [
    userCount,
    roleCount,
    permissionCount,
    recentAuditCount,
    unreadNotifications,
    activeUsers,
    lockedUsers,
    suspendedUsers,
    activeSessions,
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
    analyticsEnabled
      ? prisma.user.count({ where: { ...tenantFilter, status: "ACTIVE", deletedAt: null } })
      : Promise.resolve(0),
    analyticsEnabled
      ? prisma.user.count({ where: { ...tenantFilter, status: "LOCKED", deletedAt: null } })
      : Promise.resolve(0),
    analyticsEnabled
      ? prisma.user.count({ where: { ...tenantFilter, status: "SUSPENDED", deletedAt: null } })
      : Promise.resolve(0),
    analyticsEnabled
      ? prisma.session.count({ where: { expirationDate: { gt: new Date() }, user: { tenantId } } })
      : Promise.resolve(0),
  ]);

  const weeklyAuditCount = analyticsEnabled
    ? await prisma.auditLog.count({
        where: {
          ...(tenantId ? { tenantId } : {}),
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      })
    : 0;

  const chartData = analyticsEnabled
    ? Promise.all([
        getUserGrowth(tenantId!, 30),
        getLoginActivity(tenantId!, 30),
        getRoleDistribution(tenantId!),
        getSessionActivity(tenantId!, 30),
      ]).then(([userGrowth, loginActivity, roleDistribution, sessionActivity]) => ({
        userGrowth,
        loginActivity,
        roleDistribution,
        sessionActivity,
      }))
    : null;

  return {
    userCount,
    roleCount,
    permissionCount,
    recentAuditCount,
    unreadNotifications,
    notificationsEnabled,
    analyticsEnabled,
    activeUsers,
    lockedUsers,
    suspendedUsers,
    activeSessions,
    weeklyAuditCount,
    chartData,
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

      {data.analyticsEnabled && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.userCount}</div>
                <p className="text-xs text-muted-foreground">
                  {data.activeUsers} active, {data.lockedUsers} locked
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                <Activity className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.activeSessions}</div>
                <p className="text-xs text-muted-foreground">Current active sessions</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Roles</CardTitle>
                <Shield className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.roleCount}</div>
                <p className="text-xs text-muted-foreground">
                  {data.permissionCount} permissions defined
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Audit Activity</CardTitle>
                <Clock className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.weeklyAuditCount}</div>
                <p className="text-xs text-muted-foreground">Events last 7 days</p>
              </CardContent>
            </Card>
          </div>

          {data.suspendedUsers > 0 && (
            <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
              <CardContent className="flex items-center gap-3 py-4">
                <KeyRound className="size-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    {data.suspendedUsers} suspended user{data.suspendedUsers > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    Review suspended accounts and take action if needed.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {"chartData" in data && data.chartData && (
            <Suspense
              fallback={
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                      <CardContent className="flex h-[350px] items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              }
            >
              <Await resolve={(data as any).chartData}>
                {(charts: any) => (
                  <div className="grid gap-4 md:grid-cols-2">
                    <LineChartCard
                      title="User Growth"
                      data={charts.userGrowth}
                      lines={[{ dataKey: "count", name: "New Users" }]}
                      xAxisKey="date"
                    />
                    <BarChartCard
                      title="Login Activity"
                      data={charts.loginActivity}
                      dataKey="count"
                      nameKey="date"
                    />
                    {charts.roleDistribution.length > 0 && (
                      <PieChartCard title="Role Distribution" data={charts.roleDistribution} />
                    )}
                    <LineChartCard
                      title="Session Activity"
                      data={charts.sessionActivity}
                      lines={[
                        { dataKey: "count", name: "Sessions", color: "hsl(142, 71%, 45%)" },
                      ]}
                      xAxisKey="date"
                    />
                  </div>
                )}
              </Await>
            </Suspense>
          )}
        </>
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
