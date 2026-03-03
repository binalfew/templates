import { redirect, useLoaderData, useActionData, Form, Link, useSearchParams } from "react-router";

export const handle = { breadcrumb: "Delete Template" };

import { requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { getTemplate, deleteTemplate } from "~/services/message-templates.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/delete";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.BROADCASTS);

  const template = await getTemplate(params.templateId, tenantId);
  return { template };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.BROADCASTS);

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await deleteTemplate(params.templateId, ctx);
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/templates`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function DeleteTemplatePage() {
  const { template } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/templates`;

  const canDelete = !template.isSystem;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Delete Template</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details below before deleting this template.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{template.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-foreground">Channel</span>
              <p className="text-muted-foreground">{template.channel.replace(/_/g, " ")}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Type</span>
              <p className="text-muted-foreground">
                {template.isSystem ? (
                  <Badge variant="secondary" className="text-xs">System</Badge>
                ) : (
                  "Custom"
                )}
              </p>
            </div>
            {template.subject && (
              <div className="col-span-2">
                <span className="font-medium text-foreground">Subject</span>
                <p className="text-muted-foreground">{template.subject}</p>
              </div>
            )}
            <div className="col-span-2">
              <span className="font-medium text-foreground">Body</span>
              <p className="text-muted-foreground whitespace-pre-wrap text-xs mt-1 max-h-32 overflow-auto rounded bg-muted p-2">
                {template.body}
              </p>
            </div>
          </div>

          {!canDelete && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              System templates cannot be deleted.
            </div>
          )}

          {canDelete && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              This action cannot be undone. The template will be permanently removed.
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 pt-2">
            {canDelete ? (
              <Form method="post">
                <Button type="submit" variant="destructive" className="w-full sm:w-auto">
                  Delete Template
                </Button>
              </Form>
            ) : (
              <Button variant="destructive" className="w-full sm:w-auto" disabled>
                Delete Template
              </Button>
            )}
            <Button variant="outline" className="w-full sm:w-auto" asChild>
              <Link to={cancelUrl}>Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
