import { data, redirect, useLoaderData, useActionData, Form, Link } from "react-router";

export const handle = { breadcrumb: "Delete Tenant" };

import { requireAnyRole } from "~/utils/auth/require-auth.server";
import { ADMIN_ONLY } from "~/utils/auth/roles";
import { getTenantWithCounts, deleteTenant } from "~/services/tenants.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/utils/request-context.server";
import type { Route } from "./+types/delete";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAnyRole(request, [...ADMIN_ONLY]);

  const tenant = await getTenantWithCounts(params.tenantId);
  return { tenant };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAnyRole(request, [...ADMIN_ONLY]);

  const ctx = buildServiceContext(request, user);

  try {
    await deleteTenant(params.tenantId, ctx);
    return redirect(`/${params.tenant}/tenants`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function DeleteTenantPage() {
  const { tenant } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();

  const canDelete = tenant._count.users === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Delete Tenant</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details below before deleting this tenant.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{tenant.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-foreground">Email</span>
              <p className="text-muted-foreground">{tenant.email}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Phone</span>
              <p className="text-muted-foreground">{tenant.phone}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Plan</span>
              <p className="text-muted-foreground capitalize">{tenant.subscriptionPlan}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Users</span>
              <p className="text-muted-foreground">{tenant._count.users}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Roles</span>
              <p className="text-muted-foreground">{tenant._count.roles}</p>
            </div>
          </div>

          {!canDelete && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              Cannot delete this tenant because it has {tenant._count.users} user(s). Remove all
              users first.
            </div>
          )}

          {canDelete && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              This action cannot be undone. The tenant and all associated data will be permanently
              removed.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {canDelete ? (
              <Form method="post">
                <Button type="submit" variant="destructive">
                  Delete Tenant
                </Button>
              </Form>
            ) : (
              <Button variant="destructive" disabled>
                Delete Tenant
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to={`${basePrefix}/tenants/${tenant.id}`}>Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
