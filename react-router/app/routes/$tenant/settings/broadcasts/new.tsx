import { data, redirect, useActionData, useLoaderData, Form, Link, useSearchParams } from "react-router";
import { useForm, getFormProps, getInputProps, getSelectProps, getTextareaProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";

export const handle = { breadcrumb: "New Broadcast" };

import { requireFeature } from "~/lib/auth/require-auth.server";
import { FEATURE_FLAG_KEYS } from "~/lib/config/feature-flags.server";
import { createBroadcast } from "~/services/broadcasts.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { listTemplates } from "~/services/message-templates.server";
import { createBroadcastSchema } from "~/lib/schemas/broadcast";
import { MESSAGE_CHANNELS } from "~/lib/schemas/message-template";
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
  const { tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.BROADCASTS);
  const { templates } = await listTemplates(tenantId, {});
  return { templates };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireFeature(request, FEATURE_FLAG_KEYS.BROADCASTS);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: createBroadcastSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await createBroadcast(submission.value, ctx);
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/settings/broadcasts`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function NewBroadcastPage() {
  const { templates } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/settings/broadcasts`;

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createBroadcastSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create Broadcast</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Compose a new broadcast message to send to your audience.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Broadcast Details</CardTitle>
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

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                fieldId={fields.channel.id}
                label="Channel"
                required
                errors={fields.channel.errors}
              >
                <NativeSelect {...getSelectProps(fields.channel)} key={fields.channel.key}>
                  {MESSAGE_CHANNELS.map((c) => (
                    <NativeSelectOption key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>

              <Field
                fieldId={fields.templateId.id}
                label="Template"
                errors={fields.templateId.errors}
              >
                <NativeSelect {...getSelectProps(fields.templateId)} key={fields.templateId.key}>
                  <NativeSelectOption value="">None</NativeSelectOption>
                  {templates.map((t: { id: string; name: string }) => (
                    <NativeSelectOption key={t.id} value={t.id}>
                      {t.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>

            <Field fieldId={fields.subject.id} label="Subject" errors={fields.subject.errors}>
              <Input
                {...getInputProps(fields.subject, { type: "text" })}
                key={fields.subject.key}
                placeholder="Broadcast subject"
              />
            </Field>

            <Field fieldId={fields.body.id} label="Body" required errors={fields.body.errors}>
              <Textarea
                {...getTextareaProps(fields.body)}
                key={fields.body.key}
                rows={8}
                placeholder="Message body content"
              />
            </Field>

            <div className="flex flex-col gap-3 pt-4 sm:flex-row">
              <Button type="submit" className="w-full sm:w-auto">
                Create Broadcast
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
