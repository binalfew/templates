import { Link, useLoaderData } from "react-router";
import { Columns3, ArrowLeft, Pencil, Trash2 } from "lucide-react";

export const handle = { breadcrumb: "Details" };

import { requireRoleAndFeature } from "~/utils/auth/require-auth.server";
import { ADMIN_ONLY } from "~/utils/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { getField, getFieldDataCount } from "~/services/fields.server";
import { formatDataType } from "~/components/fields/+utils";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/index";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireRoleAndFeature(request, [...ADMIN_ONLY], FEATURE_FLAG_KEYS.CUSTOM_FIELDS);

  const field = await getField(params.fieldId, tenantId);
  const dataCount = await getFieldDataCount(field.name, tenantId);

  return { field, dataCount };
}

export default function FieldDetailPage() {
  const { field, dataCount } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Columns3 className="size-5 text-muted-foreground shrink-0" />
          <h2 className="text-2xl font-bold text-foreground">{field.label}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/settings/fields`}>
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/settings/fields/${field.id}/edit`}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link
              to={`${base}/settings/fields/${field.id}/delete`}
              className="text-destructive"
            >
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Field Details */}
        <Card>
          <CardHeader>
            <CardTitle>Field Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Label</span>
              <span className="font-medium">{field.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-mono text-xs">{field.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data Type</span>
              <Badge variant="secondary">{formatDataType(field.dataType)}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entity Type</span>
              <span>{field.entityType}</span>
            </div>
            {field.description && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Description</span>
                <span className="text-right max-w-[60%]">{field.description}</span>
              </div>
            )}
            {field.defaultValue && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Default Value</span>
                <span className="font-mono text-xs">{field.defaultValue}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Flags & Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Flags & Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Required</span>
              <span>
                {field.isRequired ? (
                  <span className="text-green-600">Yes</span>
                ) : (
                  <span className="text-muted-foreground">No</span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unique</span>
              <span>
                {field.isUnique ? (
                  <span className="text-green-600">Yes</span>
                ) : (
                  <span className="text-muted-foreground">No</span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Searchable</span>
              <span>
                {field.isSearchable ? (
                  <span className="text-green-600">Yes</span>
                ) : (
                  <span className="text-muted-foreground">No</span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Filterable</span>
              <span>
                {field.isFilterable ? (
                  <span className="text-green-600">Yes</span>
                ) : (
                  <span className="text-muted-foreground">No</span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Records with data</span>
              <span className="font-medium">{dataCount}</span>
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
              <span className="text-muted-foreground">Sort Order</span>
              <span>{field.sortOrder}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(field.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated</span>
              <span>{new Date(field.updatedAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
