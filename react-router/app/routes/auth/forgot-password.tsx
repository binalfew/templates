import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { data, Form, Link } from "react-router";
import { useTranslation } from "react-i18next";
import { prisma } from "~/lib/db/db.server";
import { sendEmail } from "~/lib/email/email.server";
import { passwordResetEmail } from "~/lib/email/email-templates.server";
import { env } from "~/lib/config/env.server";
import { logger } from "~/lib/monitoring/logger.server";
import { requireAnonymous } from "~/lib/auth/session.server";
import { forgotPasswordSchema } from "~/lib/schemas/password-reset";
import { prepareVerification } from "~/lib/auth/verification.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { Route } from "./+types/forgot-password";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnonymous(request);
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  await requireAnonymous(request);
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: forgotPasswordSchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { email } = submission.value;

  // Always return success to prevent email enumeration
  const user = await prisma.user.findFirst({ where: { email } });
  if (user) {
    const { otp } = await prepareVerification({
      type: "password-reset",
      target: email,
      userId: user.id,
      period: 60 * 60, // 1 hour
    });

    const template = passwordResetEmail(otp, email);
    await sendEmail({ to: email, ...template }).catch((err) => {
      logger.error({ email, err }, "Failed to send password reset email");
    });

    if (env.NODE_ENV === "development") {
      const resetUrl = `${env.APP_URL}/auth/reset-password?token=${encodeURIComponent(otp)}&email=${encodeURIComponent(email)}`;
      logger.info({ email, resetUrl }, "Password reset link (dev)");
    } else {
      logger.info({ email }, "Password reset email sent");
    }
  }

  return data({ sent: true });
}

export default function ForgotPasswordPage({ actionData }: Route.ComponentProps) {
  const { t } = useTranslation("auth");
  const sent = actionData && "sent" in actionData && actionData.sent;

  const [form, fields] = useForm({
    lastResult: sent ? undefined : (actionData as any),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: forgotPasswordSchema });
    },
    shouldRevalidate: "onBlur",
  });

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{t("forgotPasswordTitle")}</CardTitle>
              <CardDescription>
                {sent
                  ? t("forgotPasswordSubtitleSent")
                  : t("forgotPasswordSubtitleDefault")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sent ? (
                <div className="flex flex-col gap-4">
                  <div className="rounded-md bg-green-50 p-3 dark:bg-green-950">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {t("forgotPasswordSentMessage")}
                    </p>
                  </div>
                  <Link to="/auth/login">
                    <Button variant="outline" className="w-full">
                      {t("backToLogin")}
                    </Button>
                  </Link>
                </div>
              ) : (
                <Form method="post" {...getFormProps(form)}>
                  <div className="flex flex-col gap-6">
                    {form.errors && form.errors.length > 0 && (
                      <div className="rounded-md bg-destructive/10 p-3">
                        <p className="text-sm text-destructive">{form.errors[0]}</p>
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label htmlFor={fields.email.id}>{t("email")}</Label>
                      {(() => {
                        const { key, ...emailProps } = getInputProps(fields.email, {
                          type: "email",
                        });
                        return (
                          <Input
                            key={key}
                            {...emailProps}
                            placeholder="m@example.com"
                            autoComplete="email"
                            autoFocus
                          />
                        );
                      })()}
                      {fields.email.errors && (
                        <p className="text-sm text-destructive">{fields.email.errors[0]}</p>
                      )}
                    </div>

                    <Button type="submit" className="w-full">
                      {t("sendResetLink")}
                    </Button>

                    <div className="text-center text-sm">
                      <Link to="/auth/login" className="underline underline-offset-4">
                        {t("backToLogin")}
                      </Link>
                    </div>
                  </div>
                </Form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
