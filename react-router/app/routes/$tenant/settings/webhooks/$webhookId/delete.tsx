import { redirect, useLoaderData, useActionData, Form, Link } from "react-router";

export const handle = { breadcrumb: "Delete Webhook" };

import { requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import {
  getWebhookSubscriptionWithCounts,
  deleteWebhookSubscription,
} from "~/services/webhooks.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { buildServiceContext } from "~/lib/request-context.server";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { Route } from "./+types/delete";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.WEBHOOKS);

  const subscription = await getWebhookSubscriptionWithCounts(params.webhookId, tenantId);
  return { subscription };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.WEBHOOKS);

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await deleteWebhookSubscription(params.webhookId, ctx);
    return redirect(`/${params.tenant}/settings/webhooks`);
  } catch (error) {
    return handleServiceError(error);
  }
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  PAUSED: "secondary",
  DISABLED: "outline",
  SUSPENDED: "destructive",
};

export default function DeleteWebhookPage() {
  const { subscription } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const base = useBasePrefix();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Delete Webhook</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details below before deleting this webhook subscription.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Webhook Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <span className="font-medium text-foreground">URL</span>
              <p className="text-muted-foreground break-all">{subscription.url}</p>
            </div>
            {subscription.description && (
              <div>
                <span className="font-medium text-foreground">Description</span>
                <p className="text-muted-foreground">{subscription.description}</p>
              </div>
            )}
            <div>
              <span className="font-medium text-foreground">Status</span>
              <div className="mt-0.5">
                <Badge variant={STATUS_VARIANTS[subscription.status] ?? "secondary"}>
                  {subscription.status}
                </Badge>
              </div>
            </div>
            <div>
              <span className="font-medium text-foreground">Events</span>
              <p className="text-muted-foreground">
                {subscription.events.includes("*")
                  ? "All events"
                  : `${subscription.events.length} event type${subscription.events.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div>
              <span className="font-medium text-foreground">Deliveries</span>
              <p className="text-muted-foreground">{subscription._count.deliveries}</p>
            </div>
          </div>

          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            This will permanently delete the webhook subscription and all its delivery history. This
            action cannot be undone.
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Form method="post">
              <Button type="submit" variant="destructive" className="w-full sm:w-auto">
                Delete Webhook
              </Button>
            </Form>
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link to={`${base}/settings/webhooks`}>Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
