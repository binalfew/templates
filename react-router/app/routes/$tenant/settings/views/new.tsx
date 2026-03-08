import { data, redirect, useActionData, Form, Link, useSearchParams } from "react-router";
import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";

export const handle = { breadcrumb: "New View" };

import { requireRoleAndFeature } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { createView } from "~/services/saved-views.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { createViewSchema } from "~/utils/schemas/view";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { Checkbox } from "~/components/ui/checkbox";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import type { Route } from "./+types/new";

export async function loader({ request }: Route.LoaderArgs) {
  await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.SAVED_VIEWS);
  return {};
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, tenantId } = await requireRoleAndFeature(request, [...ADMIN_OR_TENANT_ADMIN], FEATURE_FLAG_KEYS.SAVED_VIEWS);

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: createViewSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const { name, entityType, viewType, isShared } = submission.value;

  try {
    await createView({
      tenantId,
      userId: user.id,
      name,
      entityType,
      viewType,
      isShared,
    });
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/settings/views`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function NewViewPage() {
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/settings/views`;

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createViewSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create View</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new custom view for your data.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Details</CardTitle>
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

            <Field fieldId={fields.name.id} label="View Name" required errors={fields.name.errors}>
              <Input
                {...getInputProps(fields.name, { type: "text" })}
                key={fields.name.key}
                placeholder="e.g. Active Users"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field fieldId={fields.entityType.id} label="Entity Type" required errors={fields.entityType.errors}>
                <NativeSelect
                  id={fields.entityType.id}
                  name={fields.entityType.name}
                  key={fields.entityType.key}
                  defaultValue={fields.entityType.initialValue}
                >
                  <NativeSelectOption value="">Select...</NativeSelectOption>
                  <NativeSelectOption value="User">User</NativeSelectOption>
                  <NativeSelectOption value="Role">Role</NativeSelectOption>
                  <NativeSelectOption value="Permission">Permission</NativeSelectOption>
                  <NativeSelectOption value="AuditLog">Audit Log</NativeSelectOption>
                </NativeSelect>
              </Field>

              <Field fieldId={fields.viewType.id} label="View Type" errors={fields.viewType.errors}>
                <NativeSelect
                  id={fields.viewType.id}
                  name={fields.viewType.name}
                  key={fields.viewType.key}
                  defaultValue={fields.viewType.initialValue}
                >
                  <NativeSelectOption value="TABLE">Table</NativeSelectOption>
                  <NativeSelectOption value="KANBAN">Kanban</NativeSelectOption>
                  <NativeSelectOption value="CALENDAR">Calendar</NativeSelectOption>
                  <NativeSelectOption value="GALLERY">Gallery</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id={fields.isShared.id} name={fields.isShared.name} value="on" />
              <label htmlFor={fields.isShared.id} className="text-sm text-foreground">
                Share this view with other users in the organization
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit">Create View</Button>
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
