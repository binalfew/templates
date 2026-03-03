import { Link, useLoaderData } from "react-router";
import { User, ArrowLeft, Pencil, Trash2, Shield, Mail, Clock } from "lucide-react";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Details" };

import { requirePermission } from "~/lib/auth/require-auth.server";
import { getUserWithCounts } from "~/services/users.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/index";

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  SUSPENDED: "bg-yellow-100 text-yellow-800",
  LOCKED: "bg-red-100 text-red-800",
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, isSuperAdmin } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const targetUser = await getUserWithCounts(params.userId, isSuperAdmin ? undefined : tenantId);
  return { targetUser };
}

export default function UserDetailPage() {
  const { targetUser } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border bg-muted">
            <User className="size-7 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {targetUser.name || targetUser.email}
            </h2>
            <p className="text-sm text-muted-foreground">@{targetUser.username}</p>
            <span
              className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[targetUser.status] ?? "bg-gray-100 text-gray-800"}`}
            >
              {targetUser.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/users`}>
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/users/${targetUser.id}/edit`}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/users/${targetUser.id}/delete`} className="text-destructive">
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="size-4 text-muted-foreground shrink-0" />
              <a href={`mailto:${targetUser.email}`} className="text-primary hover:underline">
                {targetUser.email}
              </a>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <User className="size-4 text-muted-foreground shrink-0" />
              <span>@{targetUser.username}</span>
            </div>
            {targetUser.name && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Full Name:</span>
                <span>{targetUser.name}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 text-center">
                <Shield className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-2 text-2xl font-bold">{targetUser._count.userRoles}</p>
                <p className="text-xs text-muted-foreground">Roles</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <Clock className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-2 text-2xl font-bold">{targetUser._count.sessions}</p>
                <p className="text-xs text-muted-foreground">Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Roles */}
        <Card>
          <CardHeader>
            <CardTitle>Assigned Roles</CardTitle>
          </CardHeader>
          <CardContent>
            {targetUser.userRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No roles assigned.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {targetUser.userRoles.map((ur) => (
                  <Badge key={ur.id} variant="secondary">
                    {ur.role.name}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(targetUser.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated</span>
              <span>{new Date(targetUser.updatedAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
