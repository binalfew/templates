import { redirect, useLoaderData, useActionData, Form, Link, useSearchParams } from "react-router";
export const handle = { breadcrumb: "Delete Field" };

import { requireRoleAndFeature } from "~/lib/auth/require-auth.server";
import { ADMIN_ONLY } from "~/lib/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { deleteField, getField, getFieldDataCount } from "~/services/fields.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { formatDataType } from "~/components/fields/+utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/delete";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireRoleAndFeature(request, [...ADMIN_ONLY], FEATURE_FLAG_KEYS.CUSTOM_FIELDS);

  const field = await getField(params.fieldId, tenantId);
  const dataCount = await getFieldDataCount(field.name, tenantId);

  return { field, dataCount };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_ONLY], FEATURE_FLAG_KEYS.CUSTOM_FIELDS);

  const formData = await request.formData();
  const force = formData.get("force") === "true";
  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await deleteField(params.fieldId, ctx, { force });
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/settings/fields`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function DeleteFieldPage() {
  const { field, dataCount } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/settings/fields`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Delete Field</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details below before deleting this field.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{field.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-foreground">Name</span>
              <p className="font-mono text-xs text-muted-foreground">{field.name}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Data Type</span>
              <p>
                <Badge variant="secondary">{formatDataType(field.dataType)}</Badge>
              </p>
            </div>
            <div>
              <span className="font-medium text-foreground">Entity Type</span>
              <p className="text-muted-foreground">{field.entityType}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Records with data</span>
              <p className="text-muted-foreground">{dataCount}</p>
            </div>
          </div>

          {dataCount > 0 && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              Warning: {dataCount} record{dataCount !== 1 ? "s" : ""} contain data for this field.
              Deleting will not remove the data from those records, but it will no longer be displayed
              or validated.
            </div>
          )}

          {dataCount === 0 && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              This action cannot be undone. The field definition will be permanently removed.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Form method="post">
              {dataCount > 0 && <input type="hidden" name="force" value="true" />}
              <Button type="submit" variant="destructive">
                Delete Field
              </Button>
            </Form>
            <Button variant="outline" asChild>
              <Link to={cancelUrl}>Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
