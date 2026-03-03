import { data, redirect, useActionData, useLoaderData, Form, Link } from "react-router";
import { invariantResponse } from "@epic-web/invariant";
import { requireAuth, requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import {
  getRecord,
  updateRecord,
  type CustomFieldDefinition,
} from "~/services/custom-objects.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/edit";

export const handle = { breadcrumb: "Edit Record" };

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireFeature(request, FEATURE_FLAG_KEYS.CUSTOM_OBJECTS);
  const record = await getRecord(params.recordId!);
  const fields = (record.definition.fields as unknown as CustomFieldDefinition[]) ?? [];
  return { record, fields, slug: params.slug! };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request);
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "No tenant", { status: 403 });

  const record = await getRecord(params.recordId!);
  const fields = (record.definition.fields as unknown as CustomFieldDefinition[]) ?? [];
  const formData = await request.formData();

  const recordData: Record<string, unknown> = {};
  for (const field of fields) {
    const value = formData.get(`field_${field.name}`);
    if (field.dataType === "BOOLEAN") {
      recordData[field.name] = value === "on";
    } else if (field.dataType === "NUMBER") {
      recordData[field.name] = value ? Number(value) : undefined;
    } else {
      recordData[field.name] = value ?? undefined;
    }
  }

  try {
    await updateRecord(params.recordId!, recordData);
    return redirect(`/${params.tenant}/settings/objects/${params.slug}`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function EditRecordPage() {
  const { record, fields, slug } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const base = useBasePrefix();
  const cancelUrl = `${base}/settings/objects/${slug}`;
  const recordData = record.data as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Edit Record</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the record details below.
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
        <CardContent>
          <Form method="post" className="space-y-4">
            {fields.map((field) => {
              const value = recordData[field.name];
              return (
                <div key={field.name} className="space-y-2">
                  <label htmlFor={`field_${field.name}`} className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="ml-1 text-destructive">*</span>}
                  </label>
                  {field.dataType === "BOOLEAN" ? (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`field_${field.name}`}
                        name={`field_${field.name}`}
                        value="on"
                        defaultChecked={value === true}
                      />
                      <label
                        htmlFor={`field_${field.name}`}
                        className="text-sm text-muted-foreground cursor-pointer"
                      >
                        {field.label}
                      </label>
                    </div>
                  ) : (
                    <Input
                      id={`field_${field.name}`}
                      name={`field_${field.name}`}
                      type={
                        field.dataType === "NUMBER"
                          ? "number"
                          : field.dataType === "DATE"
                            ? "date"
                            : field.dataType === "EMAIL"
                              ? "email"
                              : field.dataType === "URL"
                                ? "url"
                                : "text"
                      }
                      required={field.required}
                      defaultValue={
                        field.dataType === "DATE" && value
                          ? new Date(value as string).toISOString().split("T")[0]
                          : value != null
                            ? String(value)
                            : ""
                      }
                    />
                  )}
                </div>
              );
            })}
            <div className="flex flex-col gap-3 pt-4 sm:flex-row">
              <Button type="submit" className="w-full sm:w-auto">
                Save Changes
              </Button>
              <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
                <Link to={cancelUrl}>Cancel</Link>
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
