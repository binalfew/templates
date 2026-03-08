import { data, redirect, useActionData, useLoaderData, Form, Link } from "react-router";
import { useState } from "react";
import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";

export const handle = { breadcrumb: "New Webhook" };

import { requireRoleAndFeature } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { createWebhookSubscription } from "~/services/webhooks.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { getEventsByDomain } from "~/utils/events/webhook-events";
import { buildServiceContext } from "~/utils/request-context.server";
import { createWebhookSchema } from "~/utils/schemas/webhook";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Checkbox } from "~/components/ui/checkbox";
import { Separator } from "~/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import type { Route } from "./+types/new";

export async function loader({ request }: Route.LoaderArgs) {
  await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.WEBHOOKS);
  const eventsByDomain = getEventsByDomain();
  return { eventsByDomain };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.WEBHOOKS);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: createWebhookSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const { url, description, events, headers: headersRaw } = submission.value;
  let headers: Record<string, string> | undefined;
  if (headersRaw) {
    headers = JSON.parse(headersRaw);
  }

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    const result = await createWebhookSubscription({ url, description, events, headers }, ctx);
    return redirect(
      `/${params.tenant}/settings/webhooks/${result.subscription.id}?secret=${encodeURIComponent(result.secret)}`,
    );
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function NewWebhookPage() {
  const { eventsByDomain } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const base = useBasePrefix();
  const [wildcardChecked, setWildcardChecked] = useState(false);

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createWebhookSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create Webhook</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure a URL to receive event notifications via HTTP POST.
        </p>
      </div>

      <Form method="post" {...getFormProps(form)} className="space-y-6">
        {form.errors && form.errors.length > 0 && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {form.errors.map((error, i) => (
              <p key={i}>{error}</p>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Endpoint Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field fieldId={fields.url.id} label="Endpoint URL" required errors={fields.url.errors}>
                <Input
                  {...getInputProps(fields.url, { type: "url" })}
                  key={fields.url.key}
                  placeholder="https://example.com/webhooks"
                  className="w-full"
                />
              </Field>
              <Field fieldId={fields.description.id} label="Description" errors={fields.description.errors}>
                <Input
                  {...getInputProps(fields.description, { type: "text" })}
                  key={fields.description.key}
                  placeholder="Optional description"
                  className="w-full"
                />
              </Field>
            </div>
            <Field fieldId={fields.headers.id} label="Custom Headers (JSON)" errors={fields.headers.errors}>
              <Input
                {...getInputProps(fields.headers, { type: "text" })}
                key={fields.headers.key}
                placeholder='{"Authorization": "Bearer ..."}'
                className="w-full"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Event Subscriptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.events.errors && fields.events.errors.length > 0 && (
              <p className="text-sm text-destructive">{fields.events.errors[0]}</p>
            )}
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <Checkbox
                name="events"
                value="*"
                checked={wildcardChecked}
                onCheckedChange={(checked) => setWildcardChecked(checked === true)}
              />
              All events (wildcard)
            </label>
            <Separator />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Object.entries(eventsByDomain).map(([domain, events]) => (
                <div key={domain} className="space-y-1.5 rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    {domain}
                  </p>
                  {events.map((evt) => (
                    <label
                      key={evt.type}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        name="events"
                        value={evt.type}
                        disabled={wildcardChecked}
                      />
                      <span>{evt.type}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" className="w-full sm:w-auto">
            Create Webhook
          </Button>
          <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
            <Link to={`${base}/settings/webhooks`}>Cancel</Link>
          </Button>
        </div>
      </Form>
    </div>
  );
}
