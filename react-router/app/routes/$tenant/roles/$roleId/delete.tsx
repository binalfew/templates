import { redirect, useLoaderData, useActionData, Form, Link, useSearchParams } from "react-router";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Delete Role" };

import { requirePermission } from "~/lib/auth/require-auth.server";
import { getRoleWithCounts, deleteRole } from "~/services/roles.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/delete";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const role = await getRoleWithCounts(params.roleId, tenantId);
  return { role };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await deleteRole(params.roleId, ctx);
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/roles`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function DeleteRolePage() {
  const { role } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/roles`;

  const canDelete = role._count.userRoles === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Delete Role</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details below before deleting this role.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{role.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {role.description && (
              <div className="col-span-2">
                <span className="font-medium text-foreground">Description</span>
                <p className="text-muted-foreground">{role.description}</p>
              </div>
            )}
            <div>
              <span className="font-medium text-foreground">Users</span>
              <p className="text-muted-foreground">{role._count.userRoles}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Permissions</span>
              <p className="text-muted-foreground">{role._count.rolePermissions}</p>
            </div>
          </div>

          {!canDelete && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              Cannot delete this role because it has {role._count.userRoles} assigned user(s).
              Unassign all users first.
            </div>
          )}

          {canDelete && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              This action cannot be undone. The role and all its permission assignments will be
              permanently removed.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {canDelete ? (
              <Form method="post">
                <Button type="submit" variant="destructive">
                  Delete Role
                </Button>
              </Form>
            ) : (
              <Button variant="destructive" disabled>
                Delete Role
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to={cancelUrl}>Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
