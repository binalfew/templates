import { data, redirect, useActionData, useLoaderData, Form, Link } from "react-router";
import { useState } from "react";

export const handle = { breadcrumb: "Edit Webhook" };

import { requireRoleAndFeature } from "~/lib/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/lib/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import {
  getWebhookSubscription,
  updateWebhookSubscription,
  WebhookError,
} from "~/services/webhooks.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { getEventsByDomain } from "~/lib/events/webhook-events";
import { buildServiceContext } from "~/lib/request-context.server";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Separator } from "~/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { Route } from "./+types/edit";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.WEBHOOKS);

  const subscription = await getWebhookSubscription(params.webhookId, tenantId);
  if (!subscription) {
    throw new WebhookError("Webhook subscription not found", 404);
  }

  const eventsByDomain = getEventsByDomain();
  return { subscription, eventsByDomain };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.WEBHOOKS);

  const formData = await request.formData();
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

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await updateWebhookSubscription(params.webhookId, { url, description, events, headers }, ctx);
    return redirect(`/${params.tenant}/settings/webhooks`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function EditWebhookPage() {
  const { subscription, eventsByDomain } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const base = useBasePrefix();

  const existingEvents = subscription.events as string[];
  const [wildcardChecked, setWildcardChecked] = useState(existingEvents.includes("*"));

  const existingHeaders =
    subscription.headers && typeof subscription.headers === "object"
      ? JSON.stringify(subscription.headers)
      : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Edit Webhook</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the webhook subscription configuration.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Endpoint Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="url">Endpoint URL</Label>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  defaultValue={subscription.url}
                  placeholder="https://example.com/webhooks"
                  required
                  className="w-full"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  name="description"
                  defaultValue={subscription.description ?? ""}
                  placeholder="Optional description"
                  className="w-full"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="headers">Custom Headers (JSON)</Label>
              <Input
                id="headers"
                name="headers"
                defaultValue={existingHeaders}
                placeholder='{"Authorization": "Bearer ..."}'
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Event Subscriptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <Checkbox
                name="events"
                value="*"
                checked={wildcardChecked}
                onCheckedChange={(checked) => setWildcardChecked(checked === true)}
              />
              All events (wildcard)
            </label>
            <Separator />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Object.entries(eventsByDomain).map(([domain, events]) => (
                <div key={domain} className="space-y-1.5 rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    {domain}
                  </p>
                  {events.map((evt) => (
                    <label
                      key={evt.type}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        name="events"
                        value={evt.type}
                        defaultChecked={existingEvents.includes(evt.type)}
                        disabled={wildcardChecked}
                      />
                      <span>{evt.type}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" className="w-full sm:w-auto">
            Save Changes
          </Button>
          <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
            <Link to={`${base}/settings/webhooks`}>Cancel</Link>
          </Button>
        </div>
      </Form>
    </div>
  );
}
