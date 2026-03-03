import { data, useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useState, useRef } from "react";

export const handle = { breadcrumb: "Webhooks" };

import { requirePermission } from "~/lib/require-auth.server";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/lib/feature-flags.server";
import {
  listWebhookSubscriptions,
  createWebhookSubscription,
  deleteWebhookSubscription,
  pauseWebhookSubscription,
  resumeWebhookSubscription,
  testWebhookEndpoint,
  getDeliveryLog,
} from "~/services/webhooks.server";
import { getEventsByDomain } from "~/lib/webhook-events";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/webhooks";

// --- Loader ---

export async function loader({ request }: Route.LoaderArgs) {
  const { user, roles } = await requirePermission(request, "webhook", "manage");

  const enabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.WEBHOOKS, {
    tenantId: user.tenantId ?? undefined,
    roles,
    userId: user.id,
  });

  if (!enabled) {
    return {
      enabled: false,
      subscriptions: { items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      deliveryLog: null,
      selectedSubscriptionId: null,
    };
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const subscriptions = await listWebhookSubscriptions(user.tenantId!, { page, pageSize: 20 });

  // Optionally load delivery log for a selected subscription
  const selectedSubscriptionId = url.searchParams.get("subscription");
  let deliveryLog = null;
  if (selectedSubscriptionId) {
    const logPage = parseInt(url.searchParams.get("logPage") ?? "1");
    deliveryLog = await getDeliveryLog(selectedSubscriptionId, user.tenantId!, {
      page: logPage,
      pageSize: 20,
    });
  }

  return { enabled: true, subscriptions, deliveryLog, selectedSubscriptionId };
}

// --- Action ---

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requirePermission(request, "webhook", "manage");
  const formData = await request.formData();
  const _action = formData.get("_action") as string;

  const ctx = buildServiceContext(request, user, user.tenantId!);

  try {
    if (_action === "create") {
      const url = formData.get("url") as string;
      const description = formData.get("description") as string;
      const events = formData.getAll("events") as string[];
      const headersRaw = formData.get("headers") as string;

      if (!url) return data({ error: "URL is required" }, { status: 400 });
      if (events.length === 0) {
        return data({ error: "At least one event type is required" }, { status: 400 });
      }

      let headers: Record<string, string> | undefined;
      if (headersRaw) {
        try {
          headers = JSON.parse(headersRaw);
        } catch {
          return data({ error: "Headers must be valid JSON" }, { status: 400 });
        }
      }

      const result = await createWebhookSubscription({ url, description, events, headers }, ctx);

      return data({ success: true, secret: result.secret, subscriptionId: result.subscription.id });
    }

    if (_action === "pause") {
      const id = formData.get("id") as string;
      if (!id) return data({ error: "Subscription ID is required" }, { status: 400 });
      await pauseWebhookSubscription(id, ctx);
      return data({ success: true });
    }

    if (_action === "resume") {
      const id = formData.get("id") as string;
      if (!id) return data({ error: "Subscription ID is required" }, { status: 400 });
      await resumeWebhookSubscription(id, ctx);
      return data({ success: true });
    }

    if (_action === "delete") {
      const id = formData.get("id") as string;
      if (!id) return data({ error: "Subscription ID is required" }, { status: 400 });
      await deleteWebhookSubscription(id, ctx);
      return data({ success: true });
    }

    if (_action === "test") {
      const id = formData.get("id") as string;
      if (!id) return data({ error: "Subscription ID is required" }, { status: 400 });
      const result = await testWebhookEndpoint(id, ctx);
      return data({ success: true, testResult: result });
    }

    return data({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return data({ error: error.message ?? "Operation failed" }, { status: error.status ?? 500 });
  }
}

// --- Component ---

export default function WebhooksPage() {
  const { enabled, subscriptions, deliveryLog, selectedSubscriptionId } =
    useLoaderData<typeof loader>();
  const [secret, setSecret] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  if (!enabled) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Webhooks</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Webhooks are currently disabled. Enable the FF_WEBHOOKS feature flag to use this
            feature.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Webhooks</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage webhook subscriptions for external system notifications. Events are signed with
            HMAC-SHA256.
          </p>
        </div>
        <CreateWebhookDialog onSecretCreated={setSecret} />
      </div>

      <Separator />

      {secret && <SecretAlert secret={secret} onDismiss={() => setSecret(null)} />}

      {subscriptions.items.length === 0 && !secret ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            No webhook subscriptions yet. Create one to receive real-time event notifications.
          </p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Subscriptions</CardTitle>
            <CardDescription>
              {subscriptions.meta.total} subscription
              {subscriptions.meta.total !== 1 ? "s" : ""} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {subscriptions.items.map((sub: any) => (
                <WebhookRow
                  key={sub.id}
                  subscription={sub}
                  isSelected={sub.id === selectedSubscriptionId}
                  onSelect={(id) => {
                    const params = new URLSearchParams(searchParams);
                    if (params.get("subscription") === id) {
                      params.delete("subscription");
                      params.delete("logPage");
                    } else {
                      params.set("subscription", id);
                      params.delete("logPage");
                    }
                    setSearchParams(params);
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {deliveryLog && selectedSubscriptionId && (
        <DeliveryLogPanel deliveryLog={deliveryLog} subscriptionId={selectedSubscriptionId} />
      )}
    </div>
  );
}

// --- Sub-components ---

function SecretAlert({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-950">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
          Save your webhook secret now
        </h3>
        <Button variant="ghost" size="sm" onClick={onDismiss} className="h-6 w-6 p-0">
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

function CreateWebhookDialog({ onSecretCreated }: { onSecretCreated: (s: string) => void }) {
  const fetcher = useFetcher<typeof action>();
  const [open, setOpen] = useState(false);
  const prevDataRef = useRef(fetcher.data);
  const eventsByDomain = getEventsByDomain();

  if (fetcher.data !== prevDataRef.current) {
    prevDataRef.current = fetcher.data;
    if (
      fetcher.data &&
      typeof fetcher.data === "object" &&
      "secret" in fetcher.data &&
      typeof fetcher.data.secret === "string"
    ) {
      onSecretCreated(fetcher.data.secret);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Webhook</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Webhook Subscription</DialogTitle>
          <DialogDescription>
            Configure a URL to receive event notifications via HTTP POST.
          </DialogDescription>
        </DialogHeader>
        <fetcher.Form method="POST" onSubmit={() => setOpen(false)}>
          <input type="hidden" name="_action" value="create" />
          <div className="space-y-4">
            <div>
              <Label htmlFor="url">Endpoint URL</Label>
              <Input
                id="url"
                name="url"
                type="url"
                placeholder="https://example.com/webhooks"
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" placeholder="Optional description" />
            </div>
            <div>
              <Label>Events</Label>
              <div className="mt-1 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <Checkbox name="events" value="*" />
                  All events (wildcard)
                </label>
                <Separator />
                {Object.entries(eventsByDomain).map(([domain, events]) => (
                  <div key={domain}>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                      {domain}
                    </p>
                    <div className="grid grid-cols-1 gap-1">
                      {events.map((evt) => (
                        <label key={evt.type} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox name="events" value={evt.type} />
                          <span>{evt.type}</span>
                          <span className="text-muted-foreground">-- {evt.description}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="headers">Custom Headers (JSON)</Label>
              <Input id="headers" name="headers" placeholder='{"Authorization": "Bearer ..."}' />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={fetcher.state !== "idle"}>
              {fetcher.state !== "idle" ? "Creating..." : "Create Webhook"}
            </Button>
          </DialogFooter>
        </fetcher.Form>
      </DialogContent>
    </Dialog>
  );
}

function WebhookRow({
  subscription,
  isSelected,
  onSelect,
}: {
  subscription: any;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const pauseFetcher = useFetcher();
  const resumeFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const testFetcher = useFetcher<typeof action>();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    PAUSED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    DISABLED: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    SUSPENDED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  const testResult =
    testFetcher.data && typeof testFetcher.data === "object" && "testResult" in testFetcher.data
      ? (testFetcher.data.testResult as any)
      : null;

  return (
    <div className="py-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground truncate">{subscription.url}</span>
            <Badge variant="secondary">{subscription.events.length} events</Badge>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[subscription.status] ?? ""}`}
            >
              {subscription.status}
            </span>
            {subscription.circuitBreakerOpen && <Badge variant="destructive">Circuit Open</Badge>}
          </div>
          {subscription.description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{subscription.description}</p>
          )}
          <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
            <span>Created: {new Date(subscription.createdAt).toLocaleDateString()}</span>
            {subscription.consecutiveFailures > 0 && (
              <span className="text-destructive">Failures: {subscription.consecutiveFailures}</span>
            )}
          </div>
        </div>
        <div className="ml-4 flex shrink-0 gap-2">
          <Button variant="ghost" size="sm" onClick={() => onSelect(subscription.id)}>
            {isSelected ? "Hide Log" : "View Log"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={testFetcher.state !== "idle"}
            onClick={() => {
              testFetcher.submit({ _action: "test", id: subscription.id }, { method: "POST" });
            }}
          >
            {testFetcher.state !== "idle" ? "Testing..." : "Test"}
          </Button>
          {subscription.status === "ACTIVE" && (
            <Button
              variant="outline"
              size="sm"
              disabled={pauseFetcher.state !== "idle"}
              onClick={() => {
                pauseFetcher.submit({ _action: "pause", id: subscription.id }, { method: "POST" });
              }}
            >
              Pause
            </Button>
          )}
          {subscription.status === "PAUSED" && (
            <Button
              variant="outline"
              size="sm"
              disabled={resumeFetcher.state !== "idle"}
              onClick={() => {
                resumeFetcher.submit(
                  { _action: "resume", id: subscription.id },
                  { method: "POST" },
                );
              }}
            >
              Resume
            </Button>
          )}
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Webhook</DialogTitle>
                <DialogDescription>
                  This will permanently delete the webhook subscription and all its delivery
                  history. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteFetcher.submit(
                      { _action: "delete", id: subscription.id },
                      { method: "POST" },
                    );
                    setDeleteOpen(false);
                  }}
                >
                  Delete Webhook
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {testResult && (
        <div
          className={`mt-2 rounded-md p-2 text-sm ${
            testResult.success
              ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
              : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          {testResult.success
            ? `Test passed (${testResult.statusCode}, ${testResult.latencyMs}ms)`
            : `Test failed: ${testResult.error}`}
        </div>
      )}
    </div>
  );
}

function DeliveryLogPanel({
  deliveryLog,
  subscriptionId,
}: {
  deliveryLog: any;
  subscriptionId: string;
}) {
  const statusColors: Record<string, string> = {
    PENDING: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    DELIVERED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    FAILED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    RETRYING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    DEAD_LETTER: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery Log</CardTitle>
        <CardDescription>
          {deliveryLog.meta.total} deliver{deliveryLog.meta.total !== 1 ? "ies" : "y"} total
        </CardDescription>
      </CardHeader>
      <CardContent>
        {deliveryLog.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deliveries yet.</p>
        ) : (
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
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[d.status] ?? ""}`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{d.responseCode ?? "--"}</td>
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
        )}
      </CardContent>
    </Card>
  );
}
