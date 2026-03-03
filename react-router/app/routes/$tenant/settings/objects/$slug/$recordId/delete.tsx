import { redirect, useLoaderData, useActionData, Form, Link } from "react-router";
import { invariantResponse } from "@epic-web/invariant";
import { requireAuth, requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import {
  getRecord,
  deleteRecord,
  type CustomFieldDefinition,
} from "~/services/custom-objects.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/delete";

export const handle = { breadcrumb: "Delete Record" };

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireFeature(request, FEATURE_FLAG_KEYS.CUSTOM_OBJECTS);
  const record = await getRecord(params.recordId!);
  const fields = (record.definition.fields as unknown as CustomFieldDefinition[]) ?? [];
  return { record, fields, slug: params.slug! };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  invariantResponse(user.tenantId, "No tenant", { status: 403 });

  try {
    await deleteRecord(params.recordId!);
    return redirect(`/${params.tenant}/settings/objects/${params.slug}`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function DeleteRecordPage() {
  const { record, fields, slug } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const base = useBasePrefix();
  const cancelUrl = `${base}/settings/objects/${slug}`;
  const recordData = record.data as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Delete Record</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the details below before deleting this record.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Record Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            {fields.map((field) => {
              const value = recordData[field.name];
              const display =
                field.dataType === "BOOLEAN"
                  ? value === true
                    ? "Yes"
                    : "No"
                  : field.dataType === "DATE" && value
                    ? new Date(value as string).toLocaleDateString()
                    : String(value ?? "\u2014");
              return (
                <div key={field.name}>
                  <span className="font-medium text-foreground">{field.label}</span>
                  <p className="text-muted-foreground">{display}</p>
                </div>
              );
            })}
          </div>

          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            This action cannot be undone. The record will be permanently deleted.
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Form method="post">
              <Button type="submit" variant="destructive" className="w-full sm:w-auto">
                Delete Record
              </Button>
            </Form>
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link to={cancelUrl}>Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
