import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect, useParams } from "react-router";
import { KeyRound, ArrowLeft } from "lucide-react";
import { prisma } from "~/lib/db/db.server";
import { requireUserId } from "~/lib/auth/session.server";
import { verifyPassword, hashPassword } from "~/lib/auth/auth.server";
import { changePasswordSchema } from "~/lib/schemas/profile";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Field } from "~/components/ui/field";
import type { Route } from "./+types/change-password";

export const handle = { breadcrumb: "Change Password" };

export async function action({ request, params }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: changePasswordSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { currentPassword, newPassword } = submission.value;

  const userPassword = await prisma.password.findUnique({
    where: { userId },
  });

  if (!userPassword) {
    return data(submission.reply({ formErrors: ["No password set for this account."] }), {
      status: 400,
    });
  }

  const isValid = await verifyPassword(currentPassword, userPassword.hash);
  if (!isValid) {
    return data(
      submission.reply({
        fieldErrors: { currentPassword: ["Current password is incorrect"] },
      }),
      { status: 400 },
    );
  }

  const newHash = await hashPassword(newPassword);
  await prisma.password.update({
    where: { userId },
    data: { hash: newHash },
  });

  await prisma.auditLog.create({
    data: {
      action: "UPDATE",
      entityType: "User",
      entityId: userId,
      userId,
      description: "Password changed",
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
  });

  return redirect(`/${params.tenant}/profile`);
}

export default function ChangePasswordPage({ actionData }: Route.ComponentProps) {
  const params = useParams();

  const [form, fields] = useForm({
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: changePasswordSchema });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/${params.tenant}/profile`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Change Password</h2>
          <p className="mt-1 text-sm text-muted-foreground">Update your account password.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Password
          </CardTitle>
          <CardDescription>Enter your current password and choose a new one.</CardDescription>
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
              fieldId={fields.currentPassword.id}
              label="Current Password"
              required
              errors={fields.currentPassword.errors}
            >
              <Input
                {...getInputProps(fields.currentPassword, {
                  type: "password",
                })}
                key={fields.currentPassword.key}
                autoComplete="current-password"
              />
            </Field>

            <Field
              fieldId={fields.newPassword.id}
              label="New Password"
              required
              errors={fields.newPassword.errors}
              description="At least 8 characters with uppercase, lowercase, number, and special character."
            >
              <Input
                {...getInputProps(fields.newPassword, { type: "password" })}
                key={fields.newPassword.key}
                autoComplete="new-password"
              />
            </Field>

            <Field
              fieldId={fields.confirmPassword.id}
              label="Confirm New Password"
              required
              errors={fields.confirmPassword.errors}
            >
              <Input
                {...getInputProps(fields.confirmPassword, {
                  type: "password",
                })}
                key={fields.confirmPassword.key}
                autoComplete="new-password"
              />
            </Field>

            <div className="flex gap-3 pt-2">
              <Button type="submit">Change Password</Button>
              <Button variant="outline" asChild>
                <Link to={`/${params.tenant}/profile`}>Cancel</Link>
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
