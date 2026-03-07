import { Link, useLoaderData } from "react-router";
import {
  Table2,
  LayoutGrid,
  Calendar,
  Image,
  ArrowLeft,
  Pencil,
  Trash2,
  Copy,
} from "lucide-react";
export const handle = { breadcrumb: "Details" };

import { requireRoleAndFeature } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { getView } from "~/services/saved-views.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/index";

const VIEW_TYPE_ICONS: Record<string, typeof Table2> = {
  TABLE: Table2,
  KANBAN: LayoutGrid,
  CALENDAR: Calendar,
  GALLERY: Image,
};

const VIEW_TYPE_LABELS: Record<string, string> = {
  TABLE: "Table",
  KANBAN: "Kanban",
  CALENDAR: "Calendar",
  GALLERY: "Gallery",
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.SAVED_VIEWS);

  const view = await getView(params.viewId, tenantId);
  return { view, isOwner: view.userId === user.id };
}

export default function ViewDetailPage() {
  const { view, isOwner } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

  const Icon = VIEW_TYPE_ICONS[view.viewType] ?? Table2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Icon className="size-5 text-muted-foreground shrink-0" />
          <h2 className="text-2xl font-bold text-foreground">{view.name}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/settings/views`}>
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Link>
          </Button>
          {isOwner && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to={`${base}/settings/views/${view.id}/edit`}>
                  <Pencil className="mr-1.5 size-3.5" />
                  Edit
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={`${base}/settings/views/${view.id}/duplicate`}>
                  <Copy className="mr-1.5 size-3.5" />
                  Duplicate
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={`${base}/settings/views/${view.id}/delete`} className="text-destructive">
                  <Trash2 className="mr-1.5 size-3.5" />
                  Delete
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* View Details */}
        <Card>
          <CardHeader>
            <CardTitle>View Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{view.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entity Type</span>
              <Badge variant="secondary">{view.entityType}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">View Type</span>
              <Badge variant="outline">
                {VIEW_TYPE_LABELS[view.viewType] ?? view.viewType}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Owner</span>
              <span>{view.owner?.name ?? "\u2014"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Default</span>
              <span>{view.isDefault ? "Yes" : "No"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shared</span>
              <span>{view.isShared ? "Yes" : "No"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(view.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated</span>
              <span>{new Date(view.updatedAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Filters & Sort */}
        <Card>
          <CardHeader>
            <CardTitle>Filters & Sort Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">Filters</p>
              {view.filters && Object.keys(view.filters as object).length > 0 ? (
                <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(view.filters, null, 2)}
                </pre>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground italic">No filters configured.</p>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Sort</p>
              {view.sorts && (view.sorts as unknown[]).length > 0 ? (
                <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(view.sorts, null, 2)}
                </pre>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground italic">No sort configured.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
