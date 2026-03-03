import { Link, useLoaderData } from "react-router";
import { FileText, ArrowLeft, Pencil, Trash2, PenTool } from "lucide-react";

export const handle = { breadcrumb: "Details" };

import { requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { getSectionTemplate } from "~/services/section-templates.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/index";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.FORM_DESIGNER);
  const template = await getSectionTemplate(params.templateId, tenantId);
  return { template };
}

export default function FormDetailPage() {
  const { template } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

  const statusClassName =
    template.status === "PUBLISHED"
      ? "border-green-500 text-green-700 dark:text-green-400"
      : template.status === "ARCHIVED"
        ? "text-muted-foreground"
        : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border bg-muted">
            <FileText className="size-7 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{template.name}</h2>
            <div className="mt-1 flex flex-wrap gap-2">
              <Badge
                variant={template.status === "PUBLISHED" ? "outline" : "secondary"}
                className={statusClassName}
              >
                {template.status}
              </Badge>
              <Badge variant="secondary">{template.entityType}</Badge>
            </div>
            {template.description && (
              <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/settings/forms`}>
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/settings/forms/${template.id}/edit`}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/settings/forms/${template.id}/delete`} className="text-destructive">
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Form Details */}
        <Card>
          <CardHeader>
            <CardTitle>Form Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{template.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entity Type</span>
              <Badge variant="secondary">{template.entityType}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant={template.status === "PUBLISHED" ? "outline" : "secondary"}
                className={statusClassName}
              >
                {template.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Description</span>
              <span>{template.description || "\u2014"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(template.createdAt).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated</span>
              <span>{new Date(template.updatedAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link to={`${base}/settings/forms/${template.id}/designer`}>
                  <PenTool className="mr-1.5 size-3.5" />
                  Open Designer
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={`${base}/settings/forms/${template.id}/edit`}>
                  <Pencil className="mr-1.5 size-3.5" />
                  Edit Details
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
