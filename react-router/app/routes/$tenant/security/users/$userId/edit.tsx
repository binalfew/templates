import {
  data,
  redirect,
  useActionData,
  useLoaderData,
  Form,
  Link,
  useSearchParams,
} from "react-router";
import { useForm, getFormProps, getInputProps, getSelectProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { invariantResponse } from "@epic-web/invariant";

export const handle = { breadcrumb: "Edit User" };

import { ShieldCheck, ShieldOff } from "lucide-react";
import { requirePermission } from "~/utils/auth/require-auth.server";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/utils/config/feature-flags.server";
import { getUser, updateUser, changePassword, UserError } from "~/services/users.server";
import { hasUserSetUp2FA, resetUserTwoFA } from "~/services/two-factor.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { updateUserSchema, changePasswordSchema } from "~/utils/schemas/user";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { buildServiceContext } from "~/utils/request-context.server";
import type { Route } from "./+types/edit";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, isSuperAdmin } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });

  const targetUser = await getUser(params.userId, isSuperAdmin ? undefined : tenantId);

  const twoFactorEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.TWO_FACTOR, {
    tenantId,
    userId: user.id,
  });
  const userHas2FA = twoFactorEnabled ? await hasUserSetUp2FA(params.userId) : false;

  return { targetUser, twoFactorEnabled, userHas2FA };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, isSuperAdmin } = await requirePermission(request, "settings", "manage");
  const tenantId = user.tenantId;
  invariantResponse(tenantId, "User is not associated with a tenant", { status: 403 });
  const formData = await request.formData();
  const intent = formData.get("intent");

  const ctx = { ...buildServiceContext(request, user, tenantId), isSuperAdmin };

  if (intent === "reset2fa") {
    try {
      await resetUserTwoFA(params.userId, ctx);
      return data({ reset2faSuccess: true });
    } catch {
      return data({ reset2faError: "Failed to reset 2FA" }, { status: 500 });
    }
  }

  if (intent === "changePassword") {
    const submission = parseWithZod(formData, { schema: changePasswordSchema });
    if (submission.status !== "success") {
      return data({ passwordResult: submission.reply() }, { status: 400 });
    }
    try {
      await changePassword(params.userId, submission.value.newPassword, ctx);
      return data({ passwordResult: submission.reply({ resetForm: true }), passwordSuccess: true });
    } catch (error) {
      if (error instanceof UserError) {
        return data(
          { passwordResult: submission.reply({ formErrors: [error.message] }) },
          { status: error.status },
        );
      }
      throw error;
    }
  }

  const submission = parseWithZod(formData, { schema: updateUserSchema });
  if (submission.status !== "success") {
    return data({ result: submission.reply() }, { status: 400 });
  }

  try {
    await updateUser(params.userId, submission.value, ctx);
    const redirectTo = new URL(request.url).searchParams.get("redirectTo");
    return redirect(redirectTo || `/${params.tenant}/security/users`);
  } catch (error) {
    return handleServiceError(error, { submission });
  }
}

export default function EditUserPage() {
  const { targetUser, twoFactorEnabled, userHas2FA } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const basePrefix = useBasePrefix();
  const [searchParams] = useSearchParams();
  const cancelUrl = searchParams.get("redirectTo") || `${basePrefix}/security/users`;

  const [form, fields] = useForm({
    lastResult: actionData && "result" in actionData ? actionData.result : undefined,
    defaultValue: {
      email: targetUser.email,
      username: targetUser.username,
      name: targetUser.name ?? "",
      status: targetUser.status,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: updateUserSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  const [pwForm, pwFields] = useForm({
    lastResult:
      actionData && "passwordResult" in actionData ? actionData.passwordResult : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: changePasswordSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Edit User</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update details for {targetUser.name || targetUser.email}.
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
                />
              </Field>
            </div>

            <Field fieldId={fields.name.id} label="Full Name" errors={fields.name.errors}>
              <Input {...getInputProps(fields.name, { type: "text" })} key={fields.name.key} />
            </Field>

            <Field fieldId={fields.status.id} label="Status" errors={fields.status.errors}>
              <NativeSelect {...getSelectProps(fields.status)} key={fields.status.key}>
                <NativeSelectOption value="ACTIVE">Active</NativeSelectOption>
                <NativeSelectOption value="INACTIVE">Inactive</NativeSelectOption>
                <NativeSelectOption value="SUSPENDED">Suspended</NativeSelectOption>
                <NativeSelectOption value="LOCKED">Locked</NativeSelectOption>
              </NativeSelect>
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

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <Form method="post" {...getFormProps(pwForm)} className="space-y-4">
            <input type="hidden" name="intent" value="changePassword" />

            {actionData &&
              "passwordSuccess" in actionData &&
              (actionData as any).passwordSuccess && (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
                  Password changed successfully.
                </div>
              )}

            {pwForm.errors && pwForm.errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {pwForm.errors.map((error, i) => (
                  <p key={i}>{error}</p>
                ))}
              </div>
            )}

            <Field
              fieldId={pwFields.newPassword.id}
              label="New Password"
              required
              errors={pwFields.newPassword.errors}
            >
              <Input
                {...getInputProps(pwFields.newPassword, { type: "password" })}
                key={pwFields.newPassword.key}
                placeholder="Minimum 8 characters"
              />
            </Field>

            <div className="pt-2">
              <Button type="submit" variant="outline">
                Change Password
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      {twoFactorEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Two-Factor Authentication</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {userHas2FA ? (
                  <>
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Status</p>
                      <Badge variant="default" className="bg-green-600">
                        Enabled
                      </Badge>
                    </div>
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Status</p>
                      <Badge variant="secondary">Not Set Up</Badge>
                    </div>
                  </>
                )}
              </div>

              {userHas2FA && (
                <Form method="post">
                  <input type="hidden" name="intent" value="reset2fa" />

                  {actionData &&
                    "reset2faSuccess" in actionData &&
                    (actionData as any).reset2faSuccess && (
                      <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
                        Two-factor authentication has been reset. The user will be required to set
                        it up again on their next login.
                      </div>
                    )}

                  {actionData && "reset2faError" in actionData && (
                    <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      {(actionData as any).reset2faError}
                    </div>
                  )}

                  <Button type="submit" variant="destructive" size="sm">
                    Reset 2FA
                  </Button>
                  <p className="mt-2 text-sm text-muted-foreground">
                    This will remove the user&apos;s 2FA configuration. If 2FA enforcement is
                    active, they will be required to set it up again on their next login.
                  </p>
                </Form>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
