import { Link, useLoaderData } from "react-router";
import { Shield, ArrowLeft, Pencil, Trash2, KeyRound, Users } from "lucide-react";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Details" };

import { requirePermission } from "~/utils/auth/require-auth.server";
import { getRoleWithCounts } from "~/services/roles.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/index";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const role = await getRoleWithCounts(params.roleId, tenantId);
  return { role };
}

export default function RoleDetailPage() {
  const { role } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Shield className="size-5 text-muted-foreground shrink-0" />
          <h2 className="text-2xl font-bold text-foreground">{role.name}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/security/roles`}>
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/security/roles/${role.id}/edit`}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/security/roles/${role.id}/delete`} className="text-destructive">
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Link
                to={`${base}/security/roles/${role.id}/permissions`}
                className="rounded-lg border p-4 text-center hover:bg-muted/50 transition-colors"
              >
                <KeyRound className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-2 text-2xl font-bold">{role._count.rolePermissions}</p>
                <p className="text-xs text-muted-foreground">Permissions</p>
              </Link>
              <div className="rounded-lg border p-4 text-center">
                <Users className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-2 text-2xl font-bold">{role._count.userRoles}</p>
                <p className="text-xs text-muted-foreground">Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Scope</span>
              <Badge variant="outline">{role.scope}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(role.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated</span>
              <span>{new Date(role.updatedAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link to={`${base}/security/roles/${role.id}/permissions`}>
                <KeyRound className="mr-1.5 size-3.5" />
                Manage Permissions
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`${base}/security/roles/${role.id}/edit`}>
                <Pencil className="mr-1.5 size-3.5" />
                Edit Role
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
