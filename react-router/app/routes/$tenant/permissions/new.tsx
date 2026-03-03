import { data, redirect, useActionData, Form, Link, useSearchParams } from "react-router";
import { useForm, getFormProps, getInputProps, getTextareaProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "New Permission" };

import { requirePermission } from "~/lib/auth/require-auth.server";
import { createPermission } from "~/services/permissions.server";
import { handleServiceError } from "~/lib/errors/handle-service-error.server";
import { createPermissionSchema } from "~/lib/schemas/permission";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/new";

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: createPermissionSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await createPermission(submission.value, ctx);
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/permissions`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function NewPermissionPage() {
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/permissions`;

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createPermissionSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create Permission</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Define a new resource/action permission pair.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Permission Details</CardTitle>
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
              fieldId={fields.resource.id}
              label="Resource"
              required
              errors={fields.resource.errors}
            >
              <Input
                {...getInputProps(fields.resource, { type: "text" })}
                key={fields.resource.key}
                placeholder="e.g. participant, event, settings"
              />
            </Field>

            <Field fieldId={fields.action.id} label="Action" required errors={fields.action.errors}>
              <Input
                {...getInputProps(fields.action, { type: "text" })}
                key={fields.action.key}
                placeholder="e.g. create, read, update, delete, manage"
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
                placeholder="Describe what this permission allows..."
                rows={3}
              />
            </Field>

            <div className="flex gap-3 pt-4">
              <Button type="submit">Create Permission</Button>
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
