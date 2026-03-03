import { data, redirect, useActionData, useLoaderData, Form, Link, useSearchParams } from "react-router";
import { useForm, getFormProps, getTextareaProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Edit Permission" };

import { requirePermission } from "~/lib/require-auth.server";
import { getPermission, updatePermission } from "~/services/permissions.server";
import { handleServiceError } from "~/lib/handle-service-error.server";
import { updatePermissionSchema } from "~/lib/schemas/permission";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/lib/request-context.server";
import type { Route } from "./+types/edit";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requirePermission(request, "settings", "manage");
  const permission = await getPermission(params.permissionId);
  return { permission };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: updatePermissionSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await updatePermission(params.permissionId, submission.value, ctx);
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/permissions`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function EditPermissionPage() {
  const { permission } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/permissions`;

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    defaultValue: {
      description: permission.description ?? "",
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: updatePermissionSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Edit Permission</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the description for this permission.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Permission Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-foreground">Resource</span>
              <p className="text-muted-foreground">{permission.resource}</p>
            </div>
            <div>
              <span className="font-medium text-foreground">Action</span>
              <p className="text-muted-foreground">{permission.action}</p>
            </div>
          </div>

          <Form method="post" {...getFormProps(form)} className="space-y-4">
            {form.errors && form.errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {form.errors.map((error, i) => (
                  <p key={i}>{error}</p>
                ))}
              </div>
            )}

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
