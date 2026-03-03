import { redirect, useLoaderData, useActionData, Form, Link, useSearchParams } from "react-router";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Delete User" };

import { requirePermission } from "~/lib/require-auth.server";
import { prisma } from "~/lib/db.server";
import { getUserWithCounts, deleteUser } from "~/services/users.server";
import { handleServiceError } from "~/lib/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/delete";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, isSuperAdmin } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const targetUser = await getUserWithCounts(params.userId, isSuperAdmin ? undefined : tenantId);

  const globalRole = await prisma.userRole.findFirst({
    where: { userId: params.userId, role: { scope: "GLOBAL" } },
    select: { id: true },
  });

  return { targetUser, currentUserId: user.id, isSystemAdmin: Boolean(globalRole) };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, isSuperAdmin } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });
  const ctx = { ...buildServiceContext(request, user, tenantId), isSuperAdmin };

  try {
    await deleteUser(params.userId, ctx);
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/users`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function DeleteUserPage() {
  const { targetUser, currentUserId, isSystemAdmin } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/users`;

  const isSelf = targetUser.id === currentUserId;
  const canDelete = !isSelf && !isSystemAdmin;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Delete User</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details below before deleting this user.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{targetUser.name || targetUser.email}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-foreground">Email</span>
              <p className="text-muted-foreground">{targetUser.email}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Username</span>
              <p className="text-muted-foreground">{targetUser.username}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Status</span>
              <p className="text-muted-foreground">{targetUser.status}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Roles</span>
              <p className="text-muted-foreground">{targetUser._count.userRoles}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Sessions</span>
              <p className="text-muted-foreground">{targetUser._count.sessions}</p>
            </div>
          </div>

          {isSelf && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              You cannot delete your own account.
            </div>
          )}

          {isSystemAdmin && !isSelf && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              This user is a system administrator and cannot be deleted. Remove their global admin
              role first before attempting deletion.
            </div>
          )}

          {canDelete && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              This action will soft-delete the user. They will no longer be able to log in.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {canDelete ? (
              <Form method="post">
                <Button type="submit" variant="destructive">
                  Delete User
                </Button>
              </Form>
            ) : (
              <Button variant="destructive" disabled>
                Delete User
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
