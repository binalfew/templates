import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link, redirect } from "react-router";
import { useTranslation } from "react-i18next";
import { hashPassword } from "~/lib/auth.server";
import { prisma } from "~/lib/db.server";
import { logger } from "~/lib/logger.server";
import { requireAnonymous } from "~/lib/session.server";
import { resetPasswordSchema } from "~/lib/schemas/password-reset";
import { isCodeValid } from "~/lib/verification.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { Route } from "./+types/reset-password";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnonymous(request);
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const email = url.searchParams.get("email");

  if (!token || !email) {
    throw redirect("/auth/login");
  }

  // Validate token without deleting it (will delete on password reset)
  const valid = await isCodeValid({
    code: token,
    type: "password-reset",
    target: email,
    deleteOnSuccess: false,
  });

  if (!valid) {
    return { valid: false, email, token };
  }

  return { valid: true, email, token };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAnonymous(request);
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: resetPasswordSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { token, email, password } = submission.value;

  // Validate and consume the token
  const valid = await isCodeValid({
    code: token,
    type: "password-reset",
    target: email,
    deleteOnSuccess: true,
  });

  if (!valid) {
    return data(
      submission.reply({ formErrors: ["Invalid or expired reset link. Please request a new one."] }),
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    return data(submission.reply({ formErrors: ["Account not found."] }), { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.password.upsert({
    where: { userId: user.id },
    update: { hash: passwordHash },
    create: { userId: user.id, hash: passwordHash },
  });

  logger.info({ userId: user.id }, "Password reset successfully");

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      tenantId: user.tenantId,
      action: "UPDATE",
      entityType: "Password",
      entityId: user.id,
      description: "Password reset via email",
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
  });

  throw redirect("/auth/login?reset=success");
}

export default function ResetPasswordPage({ loaderData, actionData }: Route.ComponentProps) {
  const { t } = useTranslation("auth");
  const { valid, email, token } = loaderData;

  const [form, fields] = useForm({
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: resetPasswordSchema });
    },
    shouldRevalidate: "onBlur",
  });

  if (!valid) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{t("linkExpiredTitle")}</CardTitle>
              <CardDescription>
                {t("linkExpiredDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/auth/forgot-password">
                <Button className="w-full">{t("requestNewLink")}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{t("resetPasswordTitle")}</CardTitle>
              <CardDescription>{t("resetPasswordSubtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" {...getFormProps(form)}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="email" value={email} />
                <div className="flex flex-col gap-6">
                  {form.errors && form.errors.length > 0 && (
                    <div className="rounded-md bg-destructive/10 p-3">
                      <p className="text-sm text-destructive">{form.errors[0]}</p>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor={fields.password.id}>{t("newPassword")}</Label>
                    {(() => {
                      const { key, ...props } = getInputProps(fields.password, {
                        type: "password",
                      });
                      return (
                        <Input key={key} {...props} autoComplete="new-password" autoFocus />
                      );
                    })()}
                    {fields.password.errors && (
                      <p className="text-sm text-destructive">{fields.password.errors[0]}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor={fields.confirmPassword.id}>{t("confirmPassword")}</Label>
                    {(() => {
                      const { key, ...props } = getInputProps(fields.confirmPassword, {
                        type: "password",
                      });
                      return <Input key={key} {...props} autoComplete="new-password" />;
                    })()}
                    {fields.confirmPassword.errors && (
                      <p className="text-sm text-destructive">
                        {fields.confirmPassword.errors[0]}
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full">
                    {t("resetPassword")}
                  </Button>
                </div>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
