import { RouteErrorBoundary } from "~/components/route-error-boundary";
import { requireAnyRole } from "~/lib/require-auth.server";

export function ErrorBoundary() {
  return <RouteErrorBoundary context="analytics dashboard" />;
}
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/lib/feature-flags.server";
import { prisma } from "~/lib/db.server";
import {
  getUserGrowth,
  getLoginActivity,
  getRoleDistribution,
  getSessionActivity,
} from "~/services/analytics.server";
import type { TimeSeriesPoint } from "~/services/analytics.server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { LineChartCard, BarChartCard, PieChartCard } from "~/components/analytics/charts";
import { BarChart3, Users, Activity, Shield, KeyRound, Clock } from "lucide-react";
import type { Route } from "./+types/index";
import { Suspense } from "react";
import { useLoaderData, Link, Await } from "react-router";
import { useTranslation } from "react-i18next";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Loader2 } from "lucide-react";

export const handle = { breadcrumb: "Analytics" };

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireAnyRole(request, ["ADMIN", "TENANT_ADMIN"]);

  const enabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.ANALYTICS, {
    tenantId: user.tenantId ?? undefined,
  });
  if (!enabled) {
    return {
      enabled: false,
      totalUsers: 0,
      activeUsers: 0,
      lockedUsers: 0,
      suspendedUsers: 0,
      totalRoles: 0,
      totalPermissions: 0,
      recentAuditLogs: 0,
      activeSessions: 0,
    };
  }

  const tenantId = user.tenantId;
  const tenantFilter = tenantId ? { tenantId } : {};

  const [
    totalUsers,
    activeUsers,
    lockedUsers,
    suspendedUsers,
    totalRoles,
    totalPermissions,
    recentAuditLogs,
    activeSessions,
  ] = await Promise.all([
    prisma.user.count({ where: { ...tenantFilter, deletedAt: null } }),
    prisma.user.count({ where: { ...tenantFilter, status: "ACTIVE", deletedAt: null } }),
    prisma.user.count({ where: { ...tenantFilter, status: "LOCKED", deletedAt: null } }),
    prisma.user.count({ where: { ...tenantFilter, status: "SUSPENDED", deletedAt: null } }),
    prisma.role.count({ where: tenantFilter }),
    prisma.permission.count(),
    prisma.auditLog.count({
      where: {
        ...(tenantId ? { tenantId } : {}),
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.session.count({
      where: { expirationDate: { gt: new Date() } },
    }),
  ]);

  // Defer heavy chart queries — these stream in after the initial shell renders
  const chartData = Promise.all([
    getUserGrowth(tenantId, 30),
    getLoginActivity(tenantId, 30),
    getRoleDistribution(tenantId),
    getSessionActivity(30),
  ]).then(([userGrowth, loginActivity, roleDistribution, sessionActivity]) => ({
    userGrowth,
    loginActivity,
    roleDistribution,
    sessionActivity,
  }));

  return {
    enabled: true,
    totalUsers,
    activeUsers,
    lockedUsers,
    suspendedUsers,
    totalRoles,
    totalPermissions,
    recentAuditLogs,
    activeSessions,
    chartData,
  };
}

export default function AnalyticsIndex() {
  const { t } = useTranslation("analytics");
  const data = useLoaderData<typeof loader>();

  if (!data.enabled) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("disabled")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("totalUsers")}</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {data.activeUsers} {t("activeUsers").toLowerCase()}, {data.lockedUsers} locked
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("activeSessions")}</CardTitle>
            <Activity className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activeSessions}</div>
            <p className="text-xs text-muted-foreground">{t("currentSessions")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("roles")}</CardTitle>
            <Shield className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalRoles}</div>
            <p className="text-xs text-muted-foreground">
              {t("permissionsDefined", { count: data.totalPermissions })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("auditActivity")}</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.recentAuditLogs}</div>
            <p className="text-xs text-muted-foreground">{t("eventsLastWeek")}</p>
          </CardContent>
        </Card>
      </div>

      {data.suspendedUsers > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <CardContent className="flex items-center gap-3 py-4">
            <KeyRound className="size-5 text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {t("suspendedWarning", { count: data.suspendedUsers })}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                {t("suspendedReview")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts — streamed via Suspense */}
      {"chartData" in data && (
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
                  title={t("userGrowth")}
                  data={charts.userGrowth}
                  lines={[{ dataKey: "count", name: "New Users" }]}
                  xAxisKey="date"
                />
                <BarChartCard
                  title={t("loginActivity")}
                  data={charts.loginActivity}
                  dataKey="count"
                  nameKey="date"
                />
                {charts.roleDistribution.length > 0 && (
                  <PieChartCard
                    title={t("roleDistribution")}
                    data={charts.roleDistribution}
                  />
                )}
                <LineChartCard
                  title={t("sessionActivity")}
                  data={charts.sessionActivity}
                  lines={[{ dataKey: "count", name: "Sessions", color: "hsl(142, 71%, 45%)" }]}
                  xAxisKey="date"
                />
              </div>
            )}
          </Await>
        </Suspense>
      )}
    </div>
  );
}
