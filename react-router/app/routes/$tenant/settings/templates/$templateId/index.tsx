import { Link, useLoaderData } from "react-router";
import { FileText, ArrowLeft, Pencil, Trash2 } from "lucide-react";

export const handle = { breadcrumb: "Details" };

import { requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { getTemplate } from "~/services/message-templates.server";
import { CHANNEL_COLORS } from "~/lib/email/messaging-constants";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/index";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.BROADCASTS);
  const template = await getTemplate(params.templateId, tenantId);
  return { template };
}

export default function TemplateDetailPage() {
  const { template } = useLoaderData<typeof loader>();
  const base = useBasePrefix();

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
            <Badge variant="secondary" className={CHANNEL_COLORS[template.channel]}>
              {template.channel}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/settings/templates`}>
              <ArrowLeft className="mr-1.5 size-3.5" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/settings/templates/${template.id}/edit`}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`${base}/settings/templates/${template.id}/delete`} className="text-destructive">
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Template Details */}
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{template.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Channel</span>
              <Badge variant="secondary" className={CHANNEL_COLORS[template.channel]}>
                {template.channel}
              </Badge>
            </div>
            {template.subject && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subject</span>
                <span>{template.subject}</span>
              </div>
            )}
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

        {/* Body */}
        <Card>
          <CardHeader>
            <CardTitle>Body</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
              {template.body}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
