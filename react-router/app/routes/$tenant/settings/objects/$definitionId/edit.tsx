import { data, redirect, useActionData, useLoaderData, Form, Link, useSearchParams } from "react-router";
import { useForm, getFormProps, getInputProps, getTextareaProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";

export const handle = { breadcrumb: "Edit Object" };

import { requireRoleAndFeature } from "~/lib/auth/require-auth.server";
import { ADMIN_ONLY } from "~/lib/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { getDefinition, updateDefinition } from "~/services/custom-objects.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { updateCustomObjectSchema } from "~/lib/schemas/custom-object";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/edit";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireRoleAndFeature(request, [...ADMIN_ONLY], FEATURE_FLAG_KEYS.CUSTOM_OBJECTS);

  const definition = await getDefinition(params.definitionId);
  return { definition };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireRoleAndFeature(request, [...ADMIN_ONLY], FEATURE_FLAG_KEYS.CUSTOM_OBJECTS);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: updateCustomObjectSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  try {
    await updateDefinition(params.definitionId, {
      name: submission.value.name,
      description: submission.value.description || undefined,
    });
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/settings/objects`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function EditCustomObjectPage() {
  const { definition } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/settings/objects`;

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    defaultValue: {
      name: definition.name,
      description: definition.description ?? "",
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: updateCustomObjectSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Edit Object Type</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update details for the {definition.name} object type.
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
              <Input {...getInputProps(fields.name, { type: "text" })} key={fields.name.key} />
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
              />
            </Field>

            <div className="flex gap-3 pt-4">
              <Button type="submit">Save Changes</Button>
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
