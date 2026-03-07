import { Link, useLoaderData } from "react-router";
import { Send, ArrowLeft, Pencil, Trash2 } from "lucide-react";

export const handle = { breadcrumb: "Details" };

import { requireRoleAndFeature } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { getBroadcastWithCounts } from "~/services/broadcasts.server";
import { BROADCAST_STATUS_COLORS, CHANNEL_COLORS } from "~/utils/email/messaging-constants";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/index";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.BROADCASTS);
  const broadcast = await getBroadcastWithCounts(params.broadcastId, tenantId);
  return { broadcast };
}

export default function BroadcastDetailPage() {
  const { broadcast } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Send className="size-5 text-muted-foreground shrink-0" />
          <h2 className="text-2xl font-bold text-foreground">
            {broadcast.subject || "(no subject)"}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/settings/broadcasts`}>
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Link>
          </Button>
          {broadcast.status === "DRAFT" && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`${base}/settings/broadcasts/${broadcast.id}/edit`}>
                <Pencil className="mr-1.5 size-3.5" />
                Edit
              </Link>
            </Button>
          )}
          {broadcast.status !== "SENDING" && (
            <Button variant="outline" size="sm" asChild>
              <Link
                to={`${base}/settings/broadcasts/${broadcast.id}/delete`}
                className="text-destructive"
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Delete
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Broadcast Details */}
        <Card>
          <CardHeader>
            <CardTitle>Broadcast Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subject</span>
              <span className="font-medium">{broadcast.subject || "(no subject)"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Channel</span>
              <Badge variant="secondary" className={CHANNEL_COLORS[broadcast.channel]}>
                {broadcast.channel}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={BROADCAST_STATUS_COLORS[broadcast.status] ?? "secondary"}>
                {broadcast.status}
              </Badge>
            </div>
            {broadcast.template && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Template</span>
                <span>{broadcast.template.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Recipients</span>
              <span>{broadcast.recipientCount ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deliveries</span>
              <span>{broadcast._count.deliveries}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(broadcast.createdAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Body */}
        <Card>
          <CardHeader>
            <CardTitle>Body</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
              {broadcast.body}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
