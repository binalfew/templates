import { data, redirect, useActionData, useLoaderData, Form, Link } from "react-router";
import { requireRoleAndFeature } from "~/utils/auth/require-auth.server";
import { ADMIN_ONLY } from "~/utils/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import {
  getDefinitionBySlug,
  createRecord,
  type CustomFieldDefinition,
} from "~/services/custom-objects.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/new";

export const handle = { breadcrumb: "New Record" };

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireRoleAndFeature(request, [...ADMIN_ONLY], FEATURE_FLAG_KEYS.CUSTOM_OBJECTS);
  const definition = await getDefinitionBySlug(tenantId, params.slug!);
  const fields = (definition.fields as unknown as CustomFieldDefinition[]) ?? [];
  return { definition, fields };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_ONLY], FEATURE_FLAG_KEYS.CUSTOM_OBJECTS);

  const definition = await getDefinitionBySlug(tenantId, params.slug!);
  const fields = (definition.fields as unknown as CustomFieldDefinition[]) ?? [];
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
    await createRecord({
      definitionId: definition.id,
      tenantId,
      data: recordData,
      createdBy: user.id,
    });
    return redirect(`/${params.tenant}/settings/objects/${params.slug}`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function NewRecordPage() {
  const { definition, fields } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const base = useBasePrefix();
  const cancelUrl = `${base}/settings/objects/${definition.slug}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">New Record</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new {definition.name} record.
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
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fields defined. Add fields to the schema first.
            </p>
          ) : (
            <Form method="post" className="space-y-4">
              {fields.map((field) => (
                <div key={field.name} className="space-y-2">
                  <label htmlFor={`field_${field.name}`} className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="ml-1 text-destructive">*</span>}
                  </label>
                  {field.dataType === "BOOLEAN" ? (
                    <div className="flex items-center gap-2">
                      <Checkbox id={`field_${field.name}`} name={`field_${field.name}`} value="on" />
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
                    />
                  )}
                </div>
              ))}
              <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                <Button type="submit" className="w-full sm:w-auto">
                  Create Record
                </Button>
                <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
                  <Link to={cancelUrl}>Cancel</Link>
                </Button>
              </div>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
