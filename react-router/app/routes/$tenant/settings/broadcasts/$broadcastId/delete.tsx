import { redirect, useLoaderData, useActionData, Form, Link, useSearchParams } from "react-router";

export const handle = { breadcrumb: "Delete Broadcast" };

import { requireRoleAndFeature } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { getBroadcastWithCounts, deleteBroadcast } from "~/services/broadcasts.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { BROADCAST_STATUS_COLORS } from "~/utils/email/messaging-constants";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/utils/request-context.server";
import type { Route } from "./+types/delete";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.BROADCASTS);
  const broadcast = await getBroadcastWithCounts(params.broadcastId, tenantId);
  return { broadcast };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.BROADCASTS);

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await deleteBroadcast(params.broadcastId, ctx);
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/settings/broadcasts`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function DeleteBroadcastPage() {
  const { broadcast } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/settings/broadcasts`;

  const canDelete = broadcast.status !== "SENDING";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Delete Broadcast</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details below before deleting this broadcast.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{broadcast.subject || "(no subject)"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-foreground">Channel</span>
              <p className="text-muted-foreground">{broadcast.channel}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Status</span>
              <div className="mt-0.5">
                <Badge variant={BROADCAST_STATUS_COLORS[broadcast.status] ?? "secondary"}>
                  {broadcast.status}
                </Badge>
              </div>
            </div>
            <div>
              <span className="font-medium text-foreground">Recipients</span>
              <p className="text-muted-foreground">{broadcast.recipientCount}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Deliveries</span>
              <p className="text-muted-foreground">{broadcast._count.deliveries}</p>
            </div>
            {broadcast.template && (
              <div className="col-span-2">
                <span className="font-medium text-foreground">Template</span>
                <p className="text-muted-foreground">{broadcast.template.name}</p>
              </div>
            )}
          </div>

          {!canDelete && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              Cannot delete this broadcast because it is currently sending. Cancel it first.
            </div>
          )}

          {canDelete && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              This action cannot be undone. The broadcast and all its delivery records will be
              permanently removed.
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            {canDelete ? (
              <Form method="post">
                <Button type="submit" variant="destructive" className="w-full sm:w-auto">
                  Delete Broadcast
                </Button>
              </Form>
            ) : (
              <Button variant="destructive" disabled className="w-full sm:w-auto">
                Delete Broadcast
              </Button>
            )}
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link to={cancelUrl}>Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
