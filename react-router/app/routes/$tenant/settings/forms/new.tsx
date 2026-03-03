import { data, redirect, useActionData, Form, Link, useSearchParams } from "react-router";
import { useForm, getFormProps, getInputProps, getTextareaProps, getSelectProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";

export const handle = { breadcrumb: "New Form" };

import { requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { createSectionTemplate } from "~/services/section-templates.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { createSectionTemplateSchema, ENTITY_TYPES_LIST } from "~/lib/schemas/section-template";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/new";

export async function loader({ request }: Route.LoaderArgs) {
  await requireFeature(request, FEATURE_FLAG_KEYS.FORM_DESIGNER);
  return {};
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.FORM_DESIGNER);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: createSectionTemplateSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    const template = await createSectionTemplate(submission.value, ctx);
    return redirect(`/${params.tenant}/settings/forms/${template.id}/designer`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function NewFormPage() {
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/settings/forms`;

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createSectionTemplateSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create Form Template</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Define a new form template. You can design its layout in the form designer after creating
          it.
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
                Create Template
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
