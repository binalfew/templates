import { data, redirect, useLoaderData, useActionData, Form, Link, useSearchParams } from "react-router";

export const handle = { breadcrumb: "Delete Object" };

import { requireFeature } from "~/lib/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/feature-flags.server";
import { getDefinition, deleteDefinition } from "~/services/custom-objects.server";
import { handleServiceError } from "~/lib/handle-service-error.server";
import type { CustomFieldDefinition } from "~/services/custom-objects.server";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/delete";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireFeature(request, FEATURE_FLAG_KEYS.CUSTOM_OBJECTS);

  const definition = await getDefinition(params.definitionId);
  return { definition };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireFeature(request, FEATURE_FLAG_KEYS.CUSTOM_OBJECTS);

  try {
    await deleteDefinition(params.definitionId);
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/objects`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function DeleteCustomObjectPage() {
  const { definition } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/objects`;

  const fields = (definition.fields as unknown as CustomFieldDefinition[]) ?? [];
  const canDelete = definition._count.records === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Delete Object Type</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details below before deleting this object type.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{definition.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-foreground">Slug</span>
              <p className="text-muted-foreground">{definition.slug}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Status</span>
              <p className="text-muted-foreground">{definition.isActive ? "Active" : "Inactive"}</p>
            </div>
            {definition.description && (
              <div className="col-span-2">
                <span className="font-medium text-foreground">Description</span>
                <p className="text-muted-foreground">{definition.description}</p>
              </div>
            )}
            <div>
              <span className="font-medium text-foreground">Fields</span>
              <p className="text-muted-foreground">{fields.length}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Records</span>
              <p className="text-muted-foreground">{definition._count.records}</p>
            </div>
          </div>

          {fields.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {fields.map((f) => (
                <Badge key={f.name} variant="secondary" className="text-xs">
                  {f.label} ({f.dataType})
                </Badge>
              ))}
            </div>
          )}

          {!canDelete && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              Cannot delete this object type because it has {definition._count.records} existing
              record(s). Delete all records first or deactivate the definition.
            </div>
          )}

          {canDelete && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              This action cannot be undone. The object type and its field definitions will be
              permanently removed.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {canDelete ? (
              <Form method="post">
                <Button type="submit" variant="destructive">
                  Delete Object Type
                </Button>
              </Form>
            ) : (
              <Button variant="destructive" disabled>
                Delete Object Type
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
