import { redirect, useLoaderData, useActionData, Form, Link } from "react-router";

export const handle = { breadcrumb: "Delete Announcement" };

import { requireAnyRole } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { getAnnouncement, deleteAnnouncement } from "~/services/announcements.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { buildServiceContext } from "~/utils/request-context.server";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { Route } from "./+types/delete";

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

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAnyRole(request, [...ADMIN_OR_TENANT_ADMIN]);
  const tenantId = user.tenantId;
  if (!tenantId) throw new Response("No tenant", { status: 403 });

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await deleteAnnouncement(params.announcementId, ctx);
    return redirect(`/${params.tenant}/settings/announcements`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function DeleteAnnouncementPage() {
  const { announcement } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const base = useBasePrefix();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Delete Announcement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details below before deleting this announcement.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Announcement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <span className="font-medium text-foreground">Title</span>
              <p className="text-muted-foreground">{announcement.title}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Type</span>
              <div className="mt-0.5">
                <Badge variant={TYPE_VARIANTS[announcement.type] ?? "secondary"}>
                  {announcement.type}
                </Badge>
              </div>
            </div>
            <div>
              <span className="font-medium text-foreground">Active</span>
              <p className="text-muted-foreground">{announcement.active ? "Yes" : "No"}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Starts At</span>
              <p className="text-muted-foreground">
                {new Date(announcement.startsAt).toLocaleString()}
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="font-medium text-foreground">Message</span>
              <p className="text-muted-foreground whitespace-pre-wrap">{announcement.message}</p>
            </div>
          </div>

          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            This will permanently delete the announcement. This action cannot be undone.
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Form method="post">
              <Button type="submit" variant="destructive" className="w-full sm:w-auto">
                Delete Announcement
              </Button>
            </Form>
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link to={`${base}/settings/announcements`}>Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
