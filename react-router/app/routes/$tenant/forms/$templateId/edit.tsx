import { data, redirect, useActionData, useLoaderData, Form, Link, useSearchParams } from "react-router";
import { useForm, getFormProps, getInputProps, getTextareaProps, getSelectProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";

export const handle = { breadcrumb: "Edit Form" };

import { requireFeature } from "~/lib/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/feature-flags.server";
import { getSectionTemplate, updateSectionTemplate } from "~/services/section-templates.server";
import { handleServiceError } from "~/lib/handle-service-error.server";
import { updateSectionTemplateSchema, ENTITY_TYPES_LIST } from "~/lib/schemas/section-template";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/edit";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.FORM_DESIGNER);
  const template = await getSectionTemplate(params.templateId, tenantId);
  return { template };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.FORM_DESIGNER);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: updateSectionTemplateSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await updateSectionTemplate(params.templateId, submission.value, ctx);
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/forms`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function EditFormPage() {
  const { template } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/forms`;

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    defaultValue: {
      name: template.name,
      description: template.description ?? "",
      entityType: template.entityType,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: updateSectionTemplateSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Edit Form Template</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the name and description for this form template.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
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

            <Field fieldId={fields.name.id} label="Name" required errors={fields.name.errors}>
              <Input
                {...getInputProps(fields.name, { type: "text" })}
                key={fields.name.key}
                placeholder="Form template name"
              />
            </Field>

            <Field
              fieldId={fields.description.id}
              label="Description"
              errors={fields.description.errors}
            >
              <Textarea
                {...getTextareaProps(fields.description)}
                key={fields.description.key}
                rows={3}
                placeholder="Optional description"
              />
            </Field>

            <Field
              fieldId={fields.entityType.id}
              label="Entity Type"
              errors={fields.entityType.errors}
              description="Which entity will this form add extra fields to?"
            >
              <NativeSelect
                {...getSelectProps(fields.entityType)}
                key={fields.entityType.key}
                className="w-full sm:w-auto sm:min-w-[160px]"
              >
                {ENTITY_TYPES_LIST.map((t) => (
                  <NativeSelectOption key={t} value={t}>
                    {t}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>

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
