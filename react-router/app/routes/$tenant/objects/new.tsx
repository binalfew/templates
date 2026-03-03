import { data, redirect, useActionData, Form, Link, useSearchParams } from "react-router";
import { useForm, getFormProps, getInputProps, getTextareaProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";

export const handle = { breadcrumb: "New Object" };

import { requireFeature } from "~/lib/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/feature-flags.server";
import { createDefinition } from "~/services/custom-objects.server";
import { handleServiceError } from "~/lib/handle-service-error.server";
import { createCustomObjectSchema } from "~/lib/schemas/custom-object";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/new";

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.CUSTOM_OBJECTS);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: createCustomObjectSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  try {
    await createDefinition({
      tenantId,
      name: submission.value.name,
      slug: submission.value.slug,
      description: submission.value.description || undefined,
      fields: [],
      createdBy: user.id,
    });
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/objects`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function NewCustomObjectPage() {
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/objects`;

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createCustomObjectSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create Object Type</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Define a new custom entity type with dynamic fields.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Object Details</CardTitle>
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
                placeholder="e.g. Vehicles"
              />
            </Field>

            <Field fieldId={fields.slug.id} label="Slug" required errors={fields.slug.errors}>
              <Input
                {...getInputProps(fields.slug, { type: "text" })}
                key={fields.slug.key}
                placeholder="e.g. vehicles"
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
                placeholder="Describe this object type..."
                rows={3}
              />
            </Field>

            <div className="flex gap-3 pt-4">
              <Button type="submit">Create Object</Button>
              <Button type="button" variant="outline" asChild>
                <Link to={cancelUrl}>Cancel</Link>
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
