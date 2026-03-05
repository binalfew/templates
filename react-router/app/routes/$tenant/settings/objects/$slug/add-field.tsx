import { data, redirect, useActionData, useLoaderData, Form, Link } from "react-router";
import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { requireRoleAndFeature } from "~/lib/auth/require-auth.server";
import { ADMIN_ONLY } from "~/lib/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import {
  getDefinitionBySlug,
  updateDefinition,
  type CustomFieldDefinition,
} from "~/services/custom-objects.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { addFieldSchema, ADD_FIELD_DATA_TYPES as DATA_TYPES } from "~/lib/schemas/custom-object";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/add-field";

export const handle = { breadcrumb: "Add Field" };

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireRoleAndFeature(request, [...ADMIN_ONLY], FEATURE_FLAG_KEYS.CUSTOM_OBJECTS);
  const definition = await getDefinitionBySlug(tenantId, params.slug!);
  const fields = (definition.fields as unknown as CustomFieldDefinition[]) ?? [];
  return { definition, fields };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_ONLY], FEATURE_FLAG_KEYS.CUSTOM_OBJECTS);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: addFieldSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const definition = await getDefinitionBySlug(tenantId, params.slug!);
  const fields = (definition.fields as unknown as CustomFieldDefinition[]) ?? [];

  const { fieldName, fieldLabel, fieldType, fieldRequired } = submission.value;

  const existingField = fields.find((f) => f.name === fieldName);
  if (existingField) {
    return data(
      { result: submission.reply({ fieldErrors: { fieldName: ["A field with this name already exists"] } }) },
      { status: 400 },
    );
  }

  fields.push({
    name: fieldName,
    label: fieldLabel,
    dataType: fieldType,
    required: fieldRequired === "on",
  });

  try {
    await updateDefinition(definition.id, tenantId, { fields });
    return redirect(`/${params.tenant}/settings/objects/${params.slug}`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function AddFieldPage() {
  const { definition, fields } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const base = useBasePrefix();
  const cancelUrl = `${base}/settings/objects/${definition.slug}`;

  const [form, formFields] = useForm({
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: addFieldSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Add Field</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new field to the {definition.name} schema.
        </p>
      </div>

      {fields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fields.map((f) => (
            <Badge key={f.name} variant="secondary">
              {f.label} ({f.dataType}){f.required ? " *" : ""}
            </Badge>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Field Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" {...getFormProps(form)} className="space-y-4">
            {form.errors && form.errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {form.errors.map((error, i) => (
                  <p key={i}>{error}</p>
                ))}
              </div>
            )}

            <Field
              fieldId={formFields.fieldName.id}
              label="Name (key)"
              required
              errors={formFields.fieldName.errors}
              description="Lowercase letters, numbers, and underscores only"
            >
              <Input
                {...getInputProps(formFields.fieldName, { type: "text" })}
                key={formFields.fieldName.key}
                placeholder="e.g. color"
              />
            </Field>

            <Field
              fieldId={formFields.fieldLabel.id}
              label="Label"
              required
              errors={formFields.fieldLabel.errors}
            >
              <Input
                {...getInputProps(formFields.fieldLabel, { type: "text" })}
                key={formFields.fieldLabel.key}
                placeholder="e.g. Color"
              />
            </Field>

            <Field
              fieldId={formFields.fieldType.id}
              label="Type"
              required
              errors={formFields.fieldType.errors}
            >
              <NativeSelect
                id={formFields.fieldType.id}
                name={formFields.fieldType.name}
                key={formFields.fieldType.key}
                defaultValue={formFields.fieldType.initialValue}
                className="w-full sm:w-auto sm:min-w-[160px]"
              >
                {DATA_TYPES.map((t) => (
                  <NativeSelectOption key={t} value={t}>
                    {t}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>

            <Field
              fieldId={formFields.fieldRequired.id}
              label="Required"
              inline
              errors={formFields.fieldRequired.errors}
            >
              <Checkbox
                id={formFields.fieldRequired.id}
                name={formFields.fieldRequired.name}
                value="on"
              />
            </Field>

            <div className="flex flex-col gap-3 pt-4 sm:flex-row">
              <Button type="submit" className="w-full sm:w-auto">
                Add Field
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
