import { Link, useLoaderData, useSearchParams } from "react-router";
import { useState } from "react";

export const handle = { breadcrumb: "Webhook Details" };

import { requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import {
  getWebhookSubscriptionWithCounts,
  getDeliveryLog,
} from "~/services/webhooks.server";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Webhook, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import type { Route } from "./+types/index";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.WEBHOOKS);

  const url = new URL(request.url);
  const secret = url.searchParams.get("secret") || null;
  const logPage = Math.max(1, Number(url.searchParams.get("logPage")) || 1);

  const [subscription, deliveryLog] = await Promise.all([
    getWebhookSubscriptionWithCounts(params.webhookId, tenantId),
    getDeliveryLog(params.webhookId, tenantId, { page: logPage, pageSize: 20 }),
  ]);

  return { subscription, secret, deliveryLog };
}

// --- Sub-components ---

function SecretAlert({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-950">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
          Save your webhook secret now
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          className="h-6 w-6 p-0"
        >
          x
        </Button>
      </div>
      <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
        This is the only time you will see this secret. Use it to verify HMAC-SHA256 signatures on
        incoming webhook payloads.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 rounded bg-yellow-100 p-2 text-xs font-mono break-all dark:bg-yellow-900">
          {secret}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  PAUSED: "secondary",
  DISABLED: "outline",
  SUSPENDED: "destructive",
};

const DELIVERY_STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  DELIVERED: "default",
  FAILED: "destructive",
  RETRYING: "secondary",
  DEAD_LETTER: "destructive",
};

export default function WebhookDetailPage() {
  const { subscription, secret, deliveryLog } = useLoaderData<typeof loader>();
  const base = useBasePrefix();
  const [searchParams, setSearchParams] = useSearchParams();

  const headers =
    subscription.headers && typeof subscription.headers === "object"
      ? (subscription.headers as Record<string, string>)
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Webhook className="size-5 text-muted-foreground shrink-0" />
          <h2 className="text-2xl font-bold text-foreground break-all">{subscription.url}</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link to={`${base}/settings/webhooks`}>
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Link>
          </Button>
          {(subscription.status === "ACTIVE" || subscription.status === "PAUSED") && (
            <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
              <Link to={`${base}/settings/webhooks/${subscription.id}/edit`}>
                <Pencil className="mr-1.5 size-3.5" />
                Edit
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link
              to={`${base}/settings/webhooks/${subscription.id}/delete`}
              className="text-destructive"
            >
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Link>
          </Button>
        </div>
      </div>

      {/* Secret alert (shown once after create) */}
      {secret && <SecretAlert secret={secret} />}

      {/* Subscription Details */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">URL</span>
              <span className="font-medium break-all text-right max-w-[60%]">
                {subscription.url}
              </span>
            </div>
            {subscription.description && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Description</span>
                <span className="font-medium">{subscription.description}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={STATUS_VARIANTS[subscription.status] ?? "secondary"}>
                {subscription.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Failures</span>
              <span
                className={
                  subscription.consecutiveFailures > 0
                    ? "font-medium text-destructive"
                    : "text-muted-foreground"
                }
              >
                {subscription.consecutiveFailures}
              </span>
            </div>
            {subscription.circuitBreakerOpen && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Circuit Breaker</span>
                <Badge variant="destructive">Open</Badge>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deliveries</span>
              <span className="font-medium">{subscription._count.deliveries}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="text-muted-foreground">
                {new Date(subscription.createdAt).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
          </CardHeader>
          <CardContent>
            {subscription.events.includes("*") ? (
              <Badge variant="secondary">All events (wildcard)</Badge>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {subscription.events.map((evt: string) => (
                  <Badge key={evt} variant="outline">
                    <code className="text-xs">{evt}</code>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Custom Headers */}
      {headers && Object.keys(headers).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Custom Headers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {Object.entries(headers).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <code className="font-medium">{key}:</code>
                  <code className="text-muted-foreground">{value}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery Log */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Log</CardTitle>
        </CardHeader>
        <CardContent>
          {deliveryLog.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliveries yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium">Event</th>
                      <th className="pb-2 pr-4 font-medium">Status</th>
                      <th className="pb-2 pr-4 font-medium">Code</th>
                      <th className="pb-2 pr-4 font-medium">Latency</th>
                      <th className="pb-2 pr-4 font-medium">Attempts</th>
                      <th className="pb-2 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {deliveryLog.items.map((d: any) => (
                      <tr key={d.id}>
                        <td className="py-2 pr-4">
                          <code className="text-xs">{d.eventType}</code>
                        </td>
                        <td className="py-2 pr-4">
                          <Badge
                            variant={DELIVERY_STATUS_VARIANTS[d.status] ?? "secondary"}
                          >
                            {d.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {d.responseCode ?? "--"}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {d.latencyMs != null ? `${d.latencyMs}ms` : "--"}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {d.attempts}/{d.maxAttempts}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {new Date(d.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {deliveryLog.meta.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {deliveryLog.meta.page} of {deliveryLog.meta.totalPages} (
                    {deliveryLog.meta.total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deliveryLog.meta.page <= 1}
                      onClick={() => {
                        const params = new URLSearchParams(searchParams);
                        params.set("logPage", String(deliveryLog.meta.page - 1));
                        setSearchParams(params);
                      }}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deliveryLog.meta.page >= deliveryLog.meta.totalPages}
                      onClick={() => {
                        const params = new URLSearchParams(searchParams);
                        params.set("logPage", String(deliveryLog.meta.page + 1));
                        setSearchParams(params);
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
