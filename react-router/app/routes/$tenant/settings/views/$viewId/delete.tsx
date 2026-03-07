import { data, redirect, useLoaderData, useActionData, Form, Link, useSearchParams } from "react-router";
export const handle = { breadcrumb: "Delete View" };

import { requireRoleAndFeature } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { getView, deleteView } from "~/services/saved-views.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/delete";

const VIEW_TYPE_LABELS: Record<string, string> = {
  TABLE: "Table",
  KANBAN: "Kanban",
  CALENDAR: "Calendar",
  GALLERY: "Gallery",
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.SAVED_VIEWS);

  const view = await getView(params.viewId, tenantId);
  if (view.userId !== user.id) {
    throw data({ error: "You can only delete your own views" }, { status: 403 });
  }

  return { view };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.SAVED_VIEWS);

  try {
    await deleteView(params.viewId, user.id, tenantId);
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/settings/views`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function DeleteViewPage() {
  const { view } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/settings/views`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Delete View</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details below before deleting this view.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {(actionData as { error: string }).error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{view.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-foreground">Entity Type</span>
              <p className="text-muted-foreground">{view.entityType}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">View Type</span>
              <p className="text-muted-foreground">
                {VIEW_TYPE_LABELS[view.viewType] ?? view.viewType}
              </p>
            </div>
            <div>
              <span className="font-medium text-foreground">Status</span>
              <div className="mt-1 flex gap-1">
                {view.isDefault && <Badge variant="secondary" className="text-xs">Default</Badge>}
                {view.isShared && <Badge variant="outline" className="text-xs">Shared</Badge>}
                {!view.isDefault && !view.isShared && (
                  <span className="text-muted-foreground">Private</span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            This action cannot be undone. The view and all its configuration will be permanently
            removed.
          </div>

          <div className="flex gap-3 pt-2">
            <Form method="post">
              <Button type="submit" variant="destructive">
                Delete View
              </Button>
            </Form>
            <Button variant="outline" asChild>
              <Link to={cancelUrl}>Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
