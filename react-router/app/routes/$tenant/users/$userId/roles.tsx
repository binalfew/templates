import { data, useLoaderData, useActionData, Form, Link, useSearchParams } from "react-router";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Assign Roles" };

import { requirePermission } from "~/lib/auth/require-auth.server";
import { getUser, assignRoles } from "~/services/users.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { listRoles } from "~/services/roles.server";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/roles";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, isSuperAdmin } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const targetUser = await getUser(params.userId, isSuperAdmin ? undefined : tenantId);
  const targetTenantId = targetUser.tenantId ?? tenantId;
  const allRoles = await listRoles(targetTenantId);
  const currentRoleIds = targetUser.userRoles.map((ur) => ur.roleId);

  return { targetUser, allRoles, currentRoleIds };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, isSuperAdmin } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const formData = await request.formData();
  const roleIds = formData.getAll("roleIds") as string[];

  const ctx = { ...buildServiceContext(request, user, tenantId), isSuperAdmin };

  try {
    await assignRoles(params.userId, roleIds, ctx);
    return data({ success: true });
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function UserRolesPage() {
  const { targetUser, allRoles, currentRoleIds } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/users`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Assign Roles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage global role assignments for {targetUser.name || targetUser.email}.
        </p>
      </div>

      {actionData && "success" in actionData && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
          Roles updated successfully.
        </div>
      )}

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" className="space-y-4">
            {allRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles available.</p>
            ) : (
              <div className="space-y-3">
                {allRoles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      name="roleIds"
                      value={role.id}
                      defaultChecked={currentRoleIds.includes(role.id)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="font-medium text-foreground">{role.name}</p>
                      {role.description && (
                        <p className="text-sm text-muted-foreground">{role.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {role._count.userRoles} user{role._count.userRoles !== 1 ? "s" : ""}
                        {" · "}
                        {role._count.rolePermissions} permission
                        {role._count.rolePermissions !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button type="submit">Save Roles</Button>
              <Button type="button" variant="outline" asChild>
                <Link to={cancelUrl}>Cancel</Link>
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
