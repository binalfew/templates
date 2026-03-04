import { Link, useLoaderData } from "react-router";
import { KeyRound, ArrowLeft, Pencil, Trash2, Shield } from "lucide-react";

export const handle = { breadcrumb: "Details" };

import { requirePermission } from "~/lib/auth/require-auth.server";
import { getPermissionWithCounts } from "~/services/permissions.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/index";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requirePermission(request, "settings", "manage");
  const permission = await getPermissionWithCounts(params.permissionId);
  return { permission };
}

export default function PermissionDetailPage() {
  const { permission } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border bg-muted">
            <KeyRound className="size-7 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{permission.resource}</h2>
            <Badge variant="default" className="mt-1">
              {permission.action}
            </Badge>
            {permission.description && (
              <p className="mt-2 text-sm text-muted-foreground">{permission.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/security/permissions`}>
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/security/permissions/${permission.id}/edit`}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/security/permissions/${permission.id}/delete`} className="text-destructive">
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle>Permission Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Resource</span>
              <span className="font-medium">{permission.resource}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Action</span>
              <Badge variant="default">{permission.action}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Description</span>
              <span>{permission.description || "\u2014"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(permission.createdAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Assigned Roles */}
        <Card>
          <CardHeader>
            <CardTitle>
              Assigned Roles ({permission._count.rolePermissions})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {permission.rolePermissions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No roles have this permission assigned.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {permission.rolePermissions.map((rp) => (
                  <Link key={rp.role.id} to={`${base}/security/roles/${rp.role.id}`}>
                    <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                      <Shield className="mr-1 size-3" />
                      {rp.role.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
