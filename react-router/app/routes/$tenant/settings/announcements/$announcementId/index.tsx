import { Link, useLoaderData } from "react-router";

export const handle = { breadcrumb: "Announcement Details" };

import { requireAnyRole } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { getAnnouncement } from "~/services/announcements.server";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Megaphone, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import type { Route } from "./+types/index";

const TYPE_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  INFO: "default",
  WARNING: "secondary",
  CRITICAL: "destructive",
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAnyRole(request, [...ADMIN_OR_TENANT_ADMIN]);
  const tenantId = user.tenantId;
  if (!tenantId) throw new Response("No tenant", { status: 403 });

  const announcement = await getAnnouncement(params.announcementId, tenantId);
  return { announcement };
}

export default function AnnouncementDetailPage() {
  const { announcement } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Megaphone className="size-5 text-muted-foreground shrink-0" />
          <h2 className="text-2xl font-bold text-foreground">{announcement.title}</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link to={`${base}/settings/announcements`}>
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link to={`${base}/settings/announcements/${announcement.id}/edit`}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link
              to={`${base}/settings/announcements/${announcement.id}/delete`}
              className="text-destructive"
            >
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Link>
          </Button>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Announcement Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Title</span>
              <span className="font-medium">{announcement.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <Badge variant={TYPE_VARIANTS[announcement.type] ?? "secondary"}>
                {announcement.type}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active</span>
              <Badge variant={announcement.active ? "default" : "outline"}>
                {announcement.active ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dismissible</span>
              <span className="font-medium">{announcement.dismissible ? "Yes" : "No"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Starts At</span>
              <span className="font-medium">
                {new Date(announcement.startsAt).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ends At</span>
              <span className="font-medium">
                {announcement.endsAt
                  ? new Date(announcement.endsAt).toLocaleString()
                  : "No end date"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="text-muted-foreground">
                {new Date(announcement.createdAt).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Message */}
      <Card>
        <CardHeader>
          <CardTitle>Message</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{announcement.message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
