import {
  data,
  redirect,
  useActionData,
  useLoaderData,
  Form,
  useSearchParams,
  Link,
} from "react-router";
import { useForm, getFormProps, getInputProps, getSelectProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "New User" };

import { requirePermission } from "~/utils/auth/require-auth.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { createUser } from "~/services/users.server";
import { listTenants } from "~/services/tenants.server";
import { createUserSchema } from "~/utils/schemas/user";
import { loadExtrasForEntity, parseExtrasForEntity } from "~/services/section-templates.server";
import { FormRenderer } from "~/components/form-renderer/form-renderer";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Field } from "~/components/ui/field";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/utils/request-context.server";
import type { Route } from "./+types/new";

export async function loader({ request }: Route.LoaderArgs) {
  const { user, isSuperAdmin } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;

  let tenants: Array<{ id: string; name: string; slug: string }> = [];
  if (isSuperAdmin) {
    tenants = (await listTenants()).map((t) => ({ id: t.id, name: t.name, slug: t.slug }));
  }

  const { extrasDefinition, extrasFieldDefs } = tenantId
    ? await loadExtrasForEntity(tenantId, "User")
    : { extrasDefinition: null, extrasFieldDefs: [] };

  return { tenants, isSuperAdmin, extrasDefinition, extrasFieldDefs };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, isSuperAdmin } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: createUserSchema });

  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  const targetTenantId =
    isSuperAdmin && submission.value.tenantId ? submission.value.tenantId : tenantId;

  const extrasResult = await parseExtrasForEntity(targetTenantId, "User", formData);
  if (extrasResult?.extrasErrors) {
    return data(
      { result: submission.reply(), extrasErrors: extrasResult.extrasErrors },
      { status: 400 },
    );
  }

  const ctx = buildServiceContext(request, user, targetTenantId);

  try {
    await createUser({ ...submission.value, tenantId: undefined, extras: extrasResult?.extras }, ctx);
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/security/users`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function NewUserPage() {
  const { tenants, isSuperAdmin, extrasDefinition, extrasFieldDefs } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/security/users`;

  const [form, fields] = useForm({
    lastResult: actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createUserSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  const extrasErrors =
    actionData && "extrasErrors" in actionData
      ? (actionData.extrasErrors as Record<string, string[]>)
      : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Create User</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new user account{isSuperAdmin ? " to any organization" : " to your organization"}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Details</CardTitle>
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

            {isSuperAdmin && tenants.length > 0 && (
              <Field
                fieldId={fields.tenantId.id}
                label="Tenant"
                required
                errors={fields.tenantId.errors}
                description="Which organization should this user belong to?"
              >
                <NativeSelect {...getSelectProps(fields.tenantId)} key={fields.tenantId.key}>
                  <NativeSelectOption value="">Select a tenant...</NativeSelectOption>
                  {tenants.map((t) => (
                    <NativeSelectOption key={t.id} value={t.id}>
                      {t.name} ({t.slug})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field fieldId={fields.email.id} label="Email" required errors={fields.email.errors}>
                <Input
                  {...getInputProps(fields.email, { type: "email" })}
                  key={fields.email.key}
                  placeholder="user@example.com"
                />
              </Field>

              <Field
                fieldId={fields.username.id}
                label="Username"
                required
                errors={fields.username.errors}
              >
                <Input
                  {...getInputProps(fields.username, { type: "text" })}
                  key={fields.username.key}
                  placeholder="e.g. jdoe"
                />
              </Field>
            </div>

            <Field fieldId={fields.name.id} label="Full Name" errors={fields.name.errors}>
              <Input
                {...getInputProps(fields.name, { type: "text" })}
                key={fields.name.key}
                placeholder="e.g. John Doe"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                fieldId={fields.password.id}
                label="Password"
                required
                errors={fields.password.errors}
              >
                <Input
                  {...getInputProps(fields.password, { type: "password" })}
                  key={fields.password.key}
                  placeholder="Minimum 8 characters"
                />
              </Field>

              <Field fieldId={fields.status.id} label="Status" errors={fields.status.errors}>
                <NativeSelect {...getSelectProps(fields.status)} key={fields.status.key}>
                  <NativeSelectOption value="ACTIVE">Active</NativeSelectOption>
                  <NativeSelectOption value="INACTIVE">Inactive</NativeSelectOption>
                  <NativeSelectOption value="SUSPENDED">Suspended</NativeSelectOption>
                </NativeSelect>
              </Field>
            </div>

            {extrasDefinition && extrasFieldDefs.length > 0 && (
              <>
                <Separator />
                <h3 className="text-lg font-semibold">Additional Information</h3>
                <FormRenderer
                  mode="inline"
                  fieldNamePrefix="extras"
                  layoutDefinition={extrasDefinition}
                  fieldDefinitions={extrasFieldDefs}
                  defaultValues={{}}
                  errors={extrasErrors}
                />
              </>
            )}

            <div className="flex gap-3 pt-4">
              <Button type="submit">Create User</Button>
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
