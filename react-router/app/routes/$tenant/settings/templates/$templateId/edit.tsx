import { data, redirect, useActionData, useLoaderData, Form, Link, useSearchParams } from "react-router";
import { useForm, getFormProps, getInputProps, getTextareaProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";

export const handle = { breadcrumb: "Edit Template" };

import { requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { getTemplate, updateTemplate } from "~/services/message-templates.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { createTemplateSchema, MESSAGE_CHANNELS } from "~/lib/schemas/message-template";
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
  const { tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.BROADCASTS);

  const template = await getTemplate(params.templateId, tenantId);
  return { template };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.BROADCASTS);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: createTemplateSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await updateTemplate(params.templateId, submission.value, ctx);
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/templates`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function EditTemplatePage() {
  const { template } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/templates`;

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    defaultValue: {
      name: template.name,
      channel: template.channel,
      subject: template.subject ?? "",
      body: template.body,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createTemplateSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Edit Template</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update details for the {template.name} template.
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
              <Input {...getInputProps(fields.name, { type: "text" })} key={fields.name.key} />
            </Field>

            <Field
              fieldId={fields.channel.id}
              label="Channel"
              required
              errors={fields.channel.errors}
            >
              <NativeSelect
                {...getInputProps(fields.channel, { type: "text" })}
                key={fields.channel.key}
              >
                {MESSAGE_CHANNELS.map((c) => (
                  <NativeSelectOption key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>

            <Field
              fieldId={fields.subject.id}
              label="Subject"
              errors={fields.subject.errors}
            >
              <Input {...getInputProps(fields.subject, { type: "text" })} key={fields.subject.key} />
            </Field>

            <Field fieldId={fields.body.id} label="Body" required errors={fields.body.errors}>
              <Textarea
                {...getTextareaProps(fields.body)}
                key={fields.body.key}
                rows={6}
              />
            </Field>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 pt-4">
              <Button type="submit" className="w-full sm:w-auto">Save Changes</Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto" asChild>
                <Link to={cancelUrl}>Cancel</Link>
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
