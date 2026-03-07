import { useLoaderData } from "react-router";
import { requireGlobalAdmin } from "~/utils/auth/require-auth.server";
import { buildMeta } from "~/utils/meta";
import {
  getDbStatus,
  getJobQueueStats,
  getApiKeyUsageSummary,
  getSystemInfo,
  getRecentAuditStats,
} from "~/services/system-health.server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Database, Cog, Key, Server, ClipboardList } from "lucide-react";
import { RouteErrorBoundary } from "~/components/route-error-boundary";
import type { Route } from "./+types/health";

export function ErrorBoundary() {
  return <RouteErrorBoundary context="system health" />;
}

export const handle = { breadcrumb: "System Health" };

export const meta: Route.MetaFunction = () =>
  buildMeta("System Health", "System status and diagnostics");

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireGlobalAdmin(request);
  const tenantId = user.tenantId ?? undefined;

  const [dbStatus, jobQueue, apiKeys, systemInfo, auditStats] = await Promise.all([
    getDbStatus(),
    getJobQueueStats(),
    tenantId ? getApiKeyUsageSummary(tenantId) : Promise.resolve([]),
    getSystemInfo(),
    getRecentAuditStats(tenantId),
  ]);

  return { dbStatus, jobQueue, apiKeys, systemInfo, auditStats };
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hrs = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hrs}h ${mins}m`;
}

export default function SystemHealthPage() {
  const { dbStatus, jobQueue, apiKeys, systemInfo, auditStats } =
    useLoaderData<typeof loader>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">System Health</h2>
        <p className="text-sm text-muted-foreground">
          Monitor system status, job queues, and resource usage.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Card 1: Database Connection */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Database Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <Badge variant={dbStatus.connected ? "default" : "destructive"}>
                {dbStatus.connected ? "Connected" : "Disconnected"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Latency: {dbStatus.latencyMs}ms
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Audit Activity (24h) */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Audit Activity (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-2xl font-bold">{auditStats.total}</p>
              <p className="text-xs text-muted-foreground">Events in the last 24 hours</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card 2: Job Queue */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Cog className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Job Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{jobQueue.counts.PENDING}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{jobQueue.counts.PROCESSING}</p>
              <p className="text-xs text-muted-foreground">Processing</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{jobQueue.counts.COMPLETED}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{jobQueue.counts.FAILED}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </div>

          {jobQueue.recentFailures.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium">Recent Failures</h4>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobQueue.recentFailures.map((failure) => (
                      <TableRow key={failure.id}>
                        <TableCell className="font-mono text-sm">{failure.type}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {failure.lastError ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(failure.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 3: API Key Usage */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Key className="h-5 w-5 text-muted-foreground" />
          <CardTitle>API Key Usage (Top 10)</CardTitle>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active API keys found.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Usage Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="text-sm font-medium">{key.name}</TableCell>
                      <TableCell className="font-mono text-sm">{key.keyPrefix}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {key.lastUsedAt
                          ? new Date(key.lastUsedAt).toLocaleString()
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-sm">{key.usageCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 4: System Info */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Server className="h-5 w-5 text-muted-foreground" />
          <CardTitle>System Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{systemInfo.nodeVersion}</p>
              <p className="text-xs text-muted-foreground">Node Version</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{formatUptime(systemInfo.uptime)}</p>
              <p className="text-xs text-muted-foreground">Uptime</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{systemInfo.memory.rss} MB</p>
              <p className="text-xs text-muted-foreground">RSS Memory</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {systemInfo.memory.heapUsed} / {systemInfo.memory.heapTotal} MB
              </p>
              <p className="text-xs text-muted-foreground">Heap Used / Total</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
